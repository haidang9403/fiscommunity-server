const createError = require("http-errors");
const { uploadFileToGCS, uploadFolderToGCS } = require("../utils/googleCloundStorage/upload.util");
const prisma = require("../services/prisma");
// const { updateSizeParentFolder } = require("../utils/helper.util");
const Folder = require("../models/document/folder.model");
const File = require("../models/document/file.model");
const { deleteFileFromGCS, deleteFolderFromGCS } = require("../utils/googleCloundStorage/delete.util");
const { getFileFromGCS, getFolderFromGCS } = require("../utils/googleCloundStorage/get.util");
const bucket = require("../services/googleCloudStorage");
const archiver = require("archiver")
const { PassThrough } = require('stream')
const path = require('path');
const { UploadDocumentWhere, TypeGroup, TypePrivacy, GroupPermission } = require("@prisma/client");
const Group = require("../models/groups/group.model");
const UserAttendGroup = require("../models/groups/user.attend.group.model");
const { getStateRelation } = require("../utils/helper.util");
const { accessSync } = require("fs");
const { updateFile, updateFileGCS, updateFolderGCS } = require("../utils/googleCloundStorage/update.util");
const { format } = require("util");
const { title } = require("process");


async function updateFolderSizes(files, folders) {
    const folderSizeMap = new Map();

    // Tính tổng size của mỗi folder
    for (const file of files) {
        folderSizeMap.set(file.folderId, (folderSizeMap.get(file.folderId) || 0) + file.size);
    }

    // Tìm tất cả thư mục cha để xử lý
    let folderQueue = [...folderSizeMap.keys()];

    for (const folder of folders) {
        if (!folderQueue.includes(folder.id)) {
            folderSizeMap.set(folder.id, 0);
            folderQueue.push(folder.id)
        }
    }

    while (folderQueue.length > 0) {
        const folders = await prisma.folder.findMany({
            where: { id: { in: folderQueue } },
            select: { id: true, parentFolderId: true, title: true, parentFolder: true },
            orderBy: {
                id: "desc"
            }
        });

        folderQueue = [];
        for (const folder of folders) {
            if (folder.parentFolderId) {


                folderSizeMap.set(
                    folder.parentFolderId,
                    (folderSizeMap.get(folder.parentFolderId) || 0) + (folderSizeMap.get(folder.id) || 0)
                );


            }
        }
    }

    // Cập nhật size cho tất cả folder
    const updatePromises = [];
    for (const [folderId, size] of folderSizeMap) {
        updatePromises.push(
            prisma.folder.update({
                where: { id: folderId },
                data: { size: { increment: size } } // Dùng `increment` để tránh ghi đè size
            })
        );
    }

    await Promise.all(updatePromises);
}

async function clearFolderContent(folder) {
    // Giả sử folder.url được lưu dạng "bucketName/destFolder/subFolderName"
    // Lấy prefix trên GCS: phần sau dấu "/"

    const prefix = folder.url.split(`${bucket.name}/`)[1];

    try {
        // 1. Xóa tất cả file trên GCS có prefix trùng với folder.url
        await bucket.deleteFiles({ prefix });
    } catch (error) {
        console.error("Error deleting files on GCS for prefix:", prefix, error);
        // Tùy vào logic, bạn có thể quyết định throw error hoặc tiếp tục
    }

    // Xóa folder hiện tại (cascade sẽ xóa hết các file và folder con)
    await prisma.folder.delete({
        where: { id: folder.id }
    });

    // Tạo lại folder mới với thông tin giống folder ban đầu, size = 0
    const newFolder = await prisma.folder.create({
        data: {
            title: folder.title,
            ownerId: folder.ownerId,
            parentFolderId: folder.parentFolderId, // giữ nguyên folder cha nếu có
            url: folder.url, // giữ nguyên URL (theo cấu trúc GCS)
            size: 0,
            privacy: folder.privacy,
            groupId: folder.groupId,
            from: folder.from
        }
    });

    if (folder.from == "GROUP") {
        await prisma.group.update({
            where: {
                id: folder.groupId
            },
            data: {
                totalStorage: {
                    decrement: folder.size
                }
            }
        })
    } else if (folder.from == "USER") {
        await prisma.user.update({
            where: {
                id: folder.ownerId
            },
            data: {
                totalStorage: {
                    decrement: folder.size
                }
            }
        })
    } else if (folder.from == "MESSAGE") {
        //
    }

    return newFolder;
}





module.exports = {
    // UPLOAD FILE
    uploadFile: async (req, res, next) => {
        try {
            const userId = req.payload.aud;
            const file = req.file;
            const replace = req.body.replace == 'false' ? false : true;
            let from = req.body.from ?? UploadDocumentWhere.USER;
            const groupId = req.params.groupId;
            const folderId = parseInt(req.body.folderId);
            let privacy = req.body.privacy;
            if (!file) {
                throw createError(400, "No file uploaded.");
            }

            // Check valid folder
            const folder = await Folder.get(folderId);
            if (folder) {
                if (parseInt(folder.ownerId) !== parseInt(userId)) {
                    throw createError(403, "You do not have permission to upload this file");
                }

                if (folder.from == UploadDocumentWhere.MESSAGE) {
                    return next(createError(400, "Folder not valid to upload"))
                }

                if (folder.from == UploadDocumentWhere.GROUP && !groupId) {
                    return next(createError(400, "Folder not valid to upload"))
                }


                if (groupId) {
                    if (folder.groupId != groupId) {
                        return next(404, "Folder not exist in group")
                    }
                }
            }

            let destUserFolder = `user-${userId}`;

            // If groupId exist
            if (groupId) {
                const group = await Group.model.findUnique({
                    where: {
                        id: parseInt(groupId)
                    }
                })

                if (group) {
                    privacy = TypePrivacy.PRIVATE_GROUP
                    from = UploadDocumentWhere.GROUP
                    destUserFolder = `group-${group.id}/user-${userId}`
                }
            }


            let fullPathFolder;
            if (folderId) {
                fullPathFolder = await Folder.getFullPathFolder(folderId)
            }
            const destFolder = `${fullPathFolder ? destUserFolder + "/" + fullPathFolder : destUserFolder}`

            uploadFileToGCS(file.buffer, file.originalname, destFolder, { replace }, async (err, result) => {
                if (err) {
                    console.log(err);
                    return next(createError(500, "Error when upload file"));
                }



                const newFile = new File({
                    title: result.fileName,
                    url: result.url,
                    size: parseFloat(result.size),
                    from,
                    ownerId: parseInt(userId),
                    groupId,
                    folderId,
                    privacy
                })

                await newFile.save();

                let totalStorage

                if (groupId) {
                    const groupUpdate = await prisma.group.update({
                        where: {
                            id: parseInt(groupId)
                        },
                        data: {
                            totalStorage: {
                                increment: parseFloat(result.size)
                            }
                        }
                    })

                    totalStorage = groupUpdate.totalStorage
                } else {
                    const userUpdate = await prisma.user.update({
                        where: {
                            id: parseInt(userId)
                        },
                        data: {
                            totalStorage: {
                                increment: parseFloat(result.size)
                            }
                        }
                    })

                    totalStorage = userUpdate.totalStorage
                }



                // Trả về URL công khai của file đã tải lên
                res.status(200).send({
                    success: true,
                    message: 'Tải file lên thành công!',
                    result,
                    totalStorage
                });
            })

        } catch (e) {
            console.log(e);
            next(createError(500, "Error when uploading file"))
        }
    },
    // UPLOAD FOLDER
    uploadFolder: async (req, res, next) => {
        try {
            const userId = req.payload.aud;
            const files = req.files;
            const paths = req.body.paths;
            const idUpdate = req.body.idUpdate;

            const replace = req.body.replace !== "false";
            const parentFolderId = parseInt(req.body.parentFolderId);
            let from = req.body.from ?? UploadDocumentWhere.USER;
            const groupId = req.params.groupId ? parseInt(req.params.groupId) : null;
            let privacy = req.body.privacy;

            const totalSizes = files.reduce((sum, file) => sum + (parseFloat(file.size) || 0), 0);

            const user = await prisma.user.findUnique({
                where: {
                    id: parseInt(userId)
                }
            })

            if (totalSizes + user.totalStorage > user.limitStorage) {
                return next(createError(400, "No space to upload"))
            }

            let destUserFolder = `user-${userId}`;
            if (groupId) {
                const group = await Group.model.findUnique({ where: { id: groupId } });
                if (group) {
                    privacy = TypePrivacy.PRIVATE_GROUP;
                    destUserFolder = `group-${group.id}/user-${userId}`;
                    from = UploadDocumentWhere.GROUP;
                }
            }

            const targetFolder = req.body.folder;
            if (!targetFolder) throw createError(400, "No folder to upload");

            if (parentFolderId) {
                const parentFolder = await Folder.get(parentFolderId);
                if (!parentFolder) return next(createError(404, "Folder not exist"));
                if (parentFolder.ownerId !== parseInt(userId)) {
                    return next(createError(403, "You do not have permission to delete this file"));
                }
                if (parentFolder.from === UploadDocumentWhere.MESSAGE ||
                    (parentFolder.from === UploadDocumentWhere.GROUP && !groupId) ||
                    (groupId && parentFolder.groupId !== groupId)) {
                    return next(createError(400, "Folder not valid to upload"));
                }
            }

            // Kiểm tra folder đã tồn tại trong DB (theo parentFolderId)
            let folder = targetFolder;
            const existingTargetFolder = await prisma.folder.findFirst({
                where: { title: folder, parentFolderId: parentFolderId, ownerId: parseInt(userId) }
            });

            if (existingTargetFolder) {
                if (replace) {
                    // Nếu replace = true, xóa toàn bộ nội dung folder cũ (trên GCS & DB)
                    await clearFolderContent(existingTargetFolder); // Bạn tự định nghĩa hàm này theo logic của hệ thống
                    folder = targetFolder; // Dùng lại tên cũ
                } else {
                    // Nếu replace = false, tạo tên mới cho folder
                    let newFolderName = folder + " - Copy";
                    let counter = 1;
                    while (await prisma.folder.findFirst({
                        where: { title: newFolderName, parentFolderId: parentFolderId, ownerId: parseInt(userId) }
                    })) {
                        newFolderName = `${folder} - Copy (${counter++})`;
                    }
                    folder = newFolderName;
                }
            }

            let fullPathParentFolder = parentFolderId ? await Folder.getFullPathFolder(parentFolderId) + "/" : "";
            const destFolder = `${destUserFolder}/${fullPathParentFolder}${folder}`.split("/").slice(0, -1).join("/");

            const filesWithPaths = files.map((file, index) => {
                let originalPath = Array.isArray(paths) ? paths[index] : paths;
                // Tách các phần của đường dẫn theo dấu "/"
                let pathParts = originalPath.split('/');
                // Nếu có ít nhất một phần, thay thế phần đầu bằng newFolderName
                if (pathParts.length > 0) {
                    pathParts[0] = folder;
                }
                return {
                    ...file,
                    webkitRelativePath: pathParts.join('/')
                };
            });

            // **Tạo folder nếu chưa tồn tại**
            const folderMap = new Map();
            for (const file of filesWithPaths) {
                const { webkitRelativePath } = file;
                if (!webkitRelativePath) continue;
                const folderPath = path.dirname(webkitRelativePath);
                if (folderPath !== ".") folderMap.set(folderPath, null);
            }

            const sortedFolders = [...folderMap.keys()].sort();

            // console.log(sortedFolders)

            const folderIds = new Map();
            const foldersToCalSize = []
            for (const folderPath of sortedFolders) {
                const pathParts = folderPath.split("/");
                let currentParentId = parentFolderId;

                for (let i = 0; i < pathParts.length; i++) {
                    const currentPath = pathParts.slice(0, i + 1).join("/");

                    if (folderIds.has(currentPath)) {
                        currentParentId = folderIds.get(currentPath);
                        continue;
                    }

                    let existingFolder = await prisma.folder.findFirst({
                        where: { title: pathParts[i], parentFolderId: currentParentId, ownerId: parseInt(userId) }
                    });

                    if (!existingFolder) {
                        existingFolder = await prisma.folder.create({
                            data: {
                                title: pathParts[i],
                                ownerId: userId,
                                parentFolderId: currentParentId,
                                url: bucket.name + "/" + destFolder + "/" + pathParts[i],
                                size: 0,
                                privacy,
                                groupId,
                                from
                            }
                        });
                    }

                    folderIds.set(currentPath, existingFolder.id);
                    currentParentId = existingFolder.id;
                    foldersToCalSize.push(existingFolder)
                }
            }

            const uploadedFiles = [];
            const MAX_CONCURRENT_UPLOADS = 200;
            const uploadQueue = [];
            const totalSize = filesWithPaths.reduce((sum, file) => sum + (parseFloat(file.size) || 0), 0);
            let uploadedBytes = 0;

            // Throttle: chỉ gửi event mỗi THROTTLE_INTERVAL ms
            const THROTTLE_INTERVAL = 100; // ms
            let lastEmitTime = Date.now();

            // **Upload files theo batch để giảm tải**
            for (const file of filesWithPaths) {
                const { webkitRelativePath, originalname, buffer, mimetype, size } = file;
                const folderPath = path.dirname(webkitRelativePath);
                const folderId = folderIds.get(folderPath) || parentFolderId;
                const destPath = `${destFolder}/${webkitRelativePath}`;

                const blob = bucket.file(destPath);
                const stream = blob.createWriteStream({ metadata: { contentType: mimetype } });

                stream.end(buffer);

                uploadQueue.push(new Promise((resolve, reject) => {
                    stream.on("finish", resolve);
                    stream.on("error", reject);
                }).then(async () => {
                    const uploadedFile = await prisma.file.create({
                        data: {
                            title: originalname,
                            url: format(`${bucket.name}/${blob.name}`),
                            size: parseFloat(size) || 0,
                            ownerId: userId,
                            folderId,
                            privacy,
                            groupId,
                            from
                        }
                    });
                    uploadedFiles.push({ ...uploadedFile, folderId });

                    uploadedBytes += parseFloat(size) || 0;
                    const progress = Math.floor((uploadedBytes / totalSize) * 100);

                    const now = Date.now();
                    if (now - lastEmitTime >= THROTTLE_INTERVAL || uploadedBytes === totalSize) {
                        lastEmitTime = now;
                        const io = req.app.get('socketio');

                        io.to(`user_${userId}`).emit('upload-progress', {
                            id: idUpdate,
                            progress,              // Phần trăm theo tổng số byte
                            uploadedSize: uploadedBytes, // Tổng số byte đã upload
                            totalSize,
                            current: uploadedFiles.length,
                            done: uploadedBytes === totalSize
                        });
                    }
                }));

                if (uploadQueue.length >= MAX_CONCURRENT_UPLOADS) {
                    await Promise.all(uploadQueue);
                    uploadQueue.length = 0;
                }
            }

            await Promise.all(uploadQueue);

            let totalStorage;

            if (groupId) {
                const groupUpdate = await prisma.group.update({
                    where: {
                        id: parseInt(groupId)
                    },
                    data: {
                        totalStorage: {
                            increment: parseFloat(totalSize)
                        }
                    }
                })

                totalStorage = groupUpdate.totalStorage
            } else {
                const userUpdate = await prisma.user.update({
                    where: {
                        id: parseInt(userId)
                    },
                    data: {
                        totalStorage: {
                            increment: parseFloat(totalSize)
                        }
                    }
                })

                totalStorage = userUpdate.totalStorage
            }

            // **Tối ưu cập nhật folder size**
            await updateFolderSizes(uploadedFiles, foldersToCalSize);

            res.status(200).json({ message: "Upload successfully!", totalStorage: totalStorage });

        } catch (e) {
            console.log(e)
            next(createError(500, "Error when uploading folder"))
        }
    },
    // DELETE FILE
    deleteFile: async (req, res, next) => {
        try {
            const fileId = req.params.fileId;
            const userId = parseInt(req.payload.aud);
            if (!fileId) throw createError(400, "No file to delete");

            // const file = await File.get(fileId);
            const file = await File.model.findUnique({
                where: {
                    id: parseInt(fileId)
                }
            });
            if (!file) throw createError(400, "File not exist")

            const groupId = req.params.groupId;

            if (!groupId && file.groupId) {
                return next(createError(404, "Not permission to delete folder"))
            }

            let isAccess = true;

            if (file.ownerId !== userId) {
                isAccess = false;
            }

            if (groupId) {
                const group = await Group.model.findUnique({
                    where: {
                        id: parseInt(groupId)
                    }
                })

                if (group) {
                    const groupPermission = await prisma.userAttendGroup.findFirst({
                        where: {
                            groupId: group.id,
                            userId: parseInt(userId)
                        }
                    })

                    if (file.groupId != group.id) {
                        return next(createError(404, "File not exist in group"))
                    }

                    if (groupPermission.permission == GroupPermission.ADMIN) {
                        isAccess = true;
                    }
                }
            }


            if (!isAccess) {
                return next(createError(403, "You do not have permission to delete this file"));
            }


            const pathFileArray = file.url.split("/");
            pathFileArray.shift();
            const pathFile = pathFileArray.join("/");

            deleteFileFromGCS(pathFile, async (error, result) => {
                try {
                    if (error) {
                        // Trả lỗi thông qua next nếu có lỗi với GCS
                        return next(createError(500, "Error when deleting file"));
                    }

                    // Tiến hành xóa file từ cơ sở dữ liệu
                    await File.delete(file.id);

                    let parentId = file.folderId

                    while (parentId) {
                        const folderParent = await prisma.folder.update({
                            where: {
                                id: parseInt(parentId)
                            },
                            data: {
                                size: {
                                    decrement: file.size
                                }
                            }
                        })

                        parentId = folderParent.parentFolderId
                    }

                    let temp

                    if (file.from == "USER") {
                        temp = await prisma.user.update({
                            where: {
                                id: parseInt(userId)
                            },
                            data: {
                                totalStorage: {
                                    decrement: file.size
                                }
                            }
                        })
                    } else if (file.from == "GROUP") {
                        temp = await prisma.group.update({
                            where: {
                                id: parseInt(groupId)
                            },
                            data: {
                                totalStorage: {
                                    decrement: file.size
                                }
                            }
                        })
                    }

                    // Gửi phản hồi thành công sau khi xóa file thành công
                    return res.status(result.statusCode).send({
                        success: result.success,
                        message: result.message,
                        totalStorage: temp.totalStorage
                    });
                } catch (err) {
                    // Nếu có lỗi trong quá trình xóa file từ cơ sở dữ liệu, trả lỗi
                    console.log(err);
                    return next(createError(500, "Error when deleting file from database"));
                }
            })
        } catch (e) {
            console.log(e)
            return next(createError(500))
        }
    },
    // DELETE FOLDER
    deleteFolder: async (req, res, next) => {
        try {
            const folderId = req.params.folderId;
            const userId = req.payload.aud;

            if (!folderId) throw createError(400, "No folder to delete");

            const folder = await Folder.get(folderId);
            if (!folder) throw createError(400, "Folder not exist")

            const groupId = req.params.groupId;

            // if (groupId && folder.groupId) {
            //     return next(createError(404, "Not permission to delete folder"))
            // }

            let isAccess = true;

            if (folder.ownerId !== userId) {
                isAccess = false;
            }

            if (groupId) {
                const group = await Group.model.findUnique({
                    where: {
                        id: parseInt(groupId)
                    }
                })

                if (group) {
                    const groupPermission = await prisma.userAttendGroup.findFirst({
                        where: {
                            groupId: group.id,
                            userId: parseInt(userId)
                        }
                    })

                    if (folder.groupId != group.id) {
                        return next(createError(404, "Folder not exist in group"))
                    }

                    if (groupPermission.permission == GroupPermission.ADMIN) {
                        isAccess = true;
                    }
                }
            }


            if (!isAccess) {
                return next(createError(403, "You do not have permission to delete this folder"));
            }

            const prefix = folder.url.split(`${bucket.name}/`)[1];

            // try {
            // 1. Xóa tất cả file trên GCS có prefix trùng với folder.url
            await bucket.deleteFiles({ prefix });
            // } catch (error) {
            //     console.error("Error deleting files on GCS for prefix:", prefix, error);
            //     // Tùy vào logic, bạn có thể quyết định throw error hoặc tiếp tục
            // }

            // Xóa folder hiện tại (cascade sẽ xóa hết các file và folder con)
            const folderCurrent = await prisma.folder.delete({
                where: { id: folder.id }
            });

            let parentId = folderCurrent.parentFolderId

            while (parentId) {
                const folderParent = await prisma.folder.update({
                    where: {
                        id: parseInt(parentId)
                    },
                    data: {
                        size: {
                            decrement: folderCurrent.size
                        }
                    }
                })

                parentId = folderParent.parentFolderId
            }

            let totalStorage

            if (folder.from == "GROUP") {
                const groupUpdate = await prisma.group.update({
                    where: {
                        id: parseInt(groupId)
                    },
                    data: {
                        totalStorage: {
                            decrement: folder.size
                        }
                    }
                })

                totalStorage = groupUpdate.totalStorage
            } else if (folder.from == "USER") {
                const userUpdate = await prisma.user.update({
                    where: {
                        id: folder.ownerId
                    },
                    data: {
                        totalStorage: {
                            decrement: folder.size
                        }
                    }
                })

                totalStorage = userUpdate.totalStorage
            }


            res.status(200).json({ message: "delete folder successfully", totalStorage })

            // const pathFolderArray = folder.url.split("/");
            // pathFolderArray.shift();
            // const pathFolder = pathFolderArray.join("/");

            // deleteFolderFromGCS(pathFolder, async (error, result) => {
            //     if (error) {
            //         return next(createError(500, "Error when delelte folder"));
            //     }

            //     try {
            //         // If GCS deletion is successful, proceed with deleting files and folder in the database
            //         const currentFolder = new Folder(folder.id);
            //         await currentFolder.deleteAllFiles(folder.id);
            //         await Folder.delete(folder.id);

            //         // Only send the response here after everything is done
            //         return res.status(result.statusCode).send({
            //             success: result.success,
            //             message: result.message,
            //         });
            //     } catch (dbError) {
            //         console.log(dbError);
            //         return next(createError(500, "Error while deleting folder data from database"));
            //     }
            // })
        } catch (e) {
            console.log(e);
            return next(createError(500))
        }
    },
    // GET STRUCETURE DOCUMENT
    getStructureDocument: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const folderId = req.query.folder;
            const groupId = req.params.groupId;

            let folders = [];
            if (groupId) {
                folders = await Folder.getAll({
                    where: {
                        groupId: parseInt(groupId),
                        from: UploadDocumentWhere.GROUP,
                        parentFolderId: parseInt(folderId) ?? null,
                    },
                    orderBy: {
                        title: "asc"
                    },
                })
            } else {
                folders = await Folder.getAll({
                    where: {
                        ownerId: userId,
                        from: UploadDocumentWhere.USER,
                        parentFolderId: parseInt(folderId) ?? null,
                    },
                    orderBy: {
                        title: "asc"
                    }
                })
            }

            const folderStructure = folders.map(folder => {
                return {
                    type: "folder",
                    data: {
                        ...folder
                    },
                }
            })

            let files = [];
            if (groupId) {
                files = await File.getAll({
                    where: {
                        groupId: parseInt(groupId),
                        from: UploadDocumentWhere.GROUP,
                        folderId: parseInt(folderId) ?? null,
                    },
                    orderBy: {
                        title: "asc"
                    },
                })
            } else {
                files = await File.getAll({
                    where: {
                        ownerId: userId,
                        from: UploadDocumentWhere.USER,
                        folderId: parseInt(folderId) ?? null,
                    },
                    orderBy: {
                        title: "asc"
                    },
                })
            }


            const fileStructure = files.map(file => {
                return {
                    type: "file",
                    data: {
                        ...file
                    }
                }
            })


            res.status(200).json([
                ...folderStructure,
                ...fileStructure
            ])
        } catch (e) {
            next(e)
        }
    },
    // GET FILE
    getFile: async (req, res, next) => {
        try {
            const fileId = req.params.fileId;
            const userId = parseInt(req.payload.aud);
            if (!fileId) throw createError(400, "No file to download");

            const file = await File.get(fileId);
            if (!file) throw createError(400, "File not exist")

            const groupId = req.params.groupId;

            if (!groupId && file.groupId) {
                return next(createError(404, "Not permission to download file"))
            }

            let isAccess = true;

            if (file.privacy == "PRIVATE" && file.ownerId !== userId && file.from == "USER") {
                isAccess = false;
            }

            if (file.privacy == "FRIENDS") {
                const relations = await getStateRelation(userId, file.ownerId)
                if (relations.includes("FRIEND")) {
                    isAccess = false
                }
            }

            if (file.from == "WORKSPACE") {
                const fileDetails = await prisma.file.findUnique({
                    where: {
                        id: file.id
                    },
                    include: {
                        taskSubmissions: {
                            include: {
                                assignedUsers: {
                                    include: {
                                        user: true
                                    }
                                }
                            }
                        },
                        announcements: true,
                        taskAttachments: {
                            include: {
                                assignedUsers: {
                                    include: {
                                        user: true
                                    }
                                }
                            }
                        }
                    }
                })

                let isValid = fileDetails.taskSubmissions.some((task) =>
                    task.assignedUsers.some(user => user.userId == userId)
                )

                isValid = fileDetails.taskAttachments.some((task) =>
                    task.assignedUsers.some(user => user.userId == userId)
                )

                isValid = fileDetails.announcements.length > 0

                isValid = true

                if (!isValid) {
                    isAccess = false
                }
            }


            if (groupId) {
                const group = await Group.model.findUnique({
                    where: {
                        id: parseInt(groupId)
                    }
                })

                if (group) {
                    const groupPermission = await prisma.userAttendGroup.findFirst({
                        where: {
                            groupId: group.id,
                            userId: parseInt(userId)
                        }
                    })

                    if (file.groupId != group.id) {
                        return next(createError(404, "File not exist in group"))
                    }

                    if (groupPermission.permission == GroupPermission.ADMIN) {
                        isAccess = true;
                    }
                }
            }


            if (!isAccess) {
                return next(createError(403, "You do not have permission to download this file"));
            }

            const pathFileArray = file.url.split("/");
            pathFileArray.shift();
            const pathFile = pathFileArray.join("/");

            getFileFromGCS(pathFile, async (error, result) => {
                if (error) return next(createError(500, "Error when get file"));

                return res.status(200).json({
                    ...file,
                    size: file.size.toString(),
                    downloadUrl: result.url
                })
            })
        } catch (e) {
            next(e)
        }
    },
    // GET FOLDER
    getFolder: async (req, res, next) => {
        try {
            const folderId = req.params.folderId;
            const userId = req.payload.aud;

            if (!folderId) throw createError(400, "No folder to download");

            const folder = await Folder.get(folderId);
            if (!folder) throw createError(400, "Folder not exist");

            const groupId = req.params.groupId;
            let isAccess = folder.ownerId === userId || folder.privacy === TypePrivacy.PUBLIC;

            if (groupId) {
                const group = await Group.model.findUnique({ where: { id: parseInt(groupId) } });
                if (group) {
                    const groupPermission = await prisma.userAttendGroup.findFirst({
                        where: { groupId: group.id, userId: parseInt(userId) }
                    });
                    if (folder.groupId === group.id && groupPermission.permission === GroupPermission.ADMIN) {
                        isAccess = true;
                    }
                }
            }

            if (!isAccess) return next(createError(403, "You do not have permission to download this file"));

            const pathFolderArray = folder.url.split("/");
            pathFolderArray.shift();
            const pathFolder = pathFolderArray.join("/");

            getFolderFromGCS(pathFolder, (error, result) => {
                if (error) {
                    res.status(500).send('Error retrieving folder contents');
                    return;
                }

                if (result.message) {
                    res.status(404).send(result.message);
                    return;
                }

                const archive = archiver('zip', { zlib: { level: 9 } });
                res.attachment(`${folder.title}_${Date.now()}.zip`);

                archive.on('error', (err) => next(err));

                archive.on('close', () => {
                    console.log('ZIP file created successfully');
                });

                archive.pipe(res);

                result.fileList.forEach((file) => {
                    const fileStream = file.createReadStream();
                    const fileName = path.relative(pathFolder, file.name);
                    const folderName = `${folder.title}/${fileName}`;
                    archive.append(fileStream, { name: folderName });
                });

                archive.finalize();
            })
        } catch (e) {
            next(e);
        }
    },
    getInfoFolder: async (req, res, next) => {
        try {
            const folderId = parseInt(req.params.folderId);
            const infoFolder = await Folder.getInfoFolder(folderId);

            res.send(infoFolder);
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when get information folder"));
        }
    },
    getFolerUser: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const folders = await prisma.folder.findMany({
                where: {
                    ownerId: userId,
                    from: UploadDocumentWhere.USER
                },
                include: {
                    childrenFolders: true,
                },
            });
            const map = {};
            const roots = [];

            folders.forEach(folder => {
                map[folder.id] = { ...folder, children: [] };
            });

            folders.forEach(folder => {
                if (folder.parentFolderId) {

                    map[folder.parentFolderId].children.push(map[folder.id]);
                } else {

                    roots.push(map[folder.id]);
                }
            });

            res.send({
                folders: roots
            })
        } catch (e) {
            console.log(e);
            next(createError(500))
        }
    },
    getFolerGroup: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const groupId = parseInt(req.params.groupId);
            const folders = await prisma.folder.findMany({
                where: {
                    groupId: groupId,
                    from: UploadDocumentWhere.GROUP
                },
                include: {
                    childrenFolders: true,
                },
            });
            const map = {};
            const roots = [];

            folders.forEach(folder => {
                map[folder.id] = { ...folder, children: [] };
            });

            folders.forEach(folder => {
                if (folder.parentFolderId) {

                    map[folder.parentFolderId].children.push(map[folder.id]);
                } else {

                    roots.push(map[folder.id]);
                }
            });

            res.send({
                folders: roots
            })
        } catch (e) {
            console.log(e);
            next(createError(500))
        }
    },
    getStructure: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const { folderIds, fileIds } = req.query;

            const folderIdsArray = folderIds?.split(",");
            const fileIdsArray = fileIds?.split(",");

            const groupId = req.params.groupId;

            let folders = [];
            if (folderIdsArray?.length > 0) {
                if (groupId) {
                    folders = await Folder.model.findMany({
                        where: {
                            groupId: parseInt(groupId),
                            id: {
                                in: folderIdsArray.map(Number)
                            },
                            from: UploadDocumentWhere.GROUP,
                        },
                        orderBy: {
                            title: "asc"
                        },
                    });
                } else {
                    folders = await Folder.model.findMany({
                        where: {
                            from: UploadDocumentWhere.USER,
                            id: {
                                in: folderIdsArray.map(Number)
                            },
                        },
                        orderBy: {
                            title: "asc"
                        }
                    });
                }
            }

            const folderStructure = folders.map(folder => {
                return {
                    type: "folder",
                    data: {
                        ...folder
                    },
                };
            });

            let files = [];
            if (fileIdsArray?.length > 0) {
                if (groupId) {
                    files = await File.model.findMany({
                        where: {
                            groupId: parseInt(groupId),
                            from: UploadDocumentWhere.GROUP,
                            id: {
                                in: fileIdsArray.map(Number)
                            }
                        },
                        orderBy: {
                            title: "asc"
                        },
                    });
                } else {
                    files = await File.model.findMany({
                        where: {
                            from: UploadDocumentWhere.USER,
                            id: {
                                in: fileIdsArray.map(Number)
                            }
                        },
                        orderBy: {
                            title: "asc"
                        },
                    });
                }
            }

            const fileStructure = files.map(file => {
                return {
                    type: "file",
                    data: {
                        ...file
                    }
                };
            });

            res.status(200).json([
                ...folderStructure,
                ...fileStructure
            ]);
        } catch (e) {
            console.log(e);
            next(createError(500));
        }
    },
    // GET STRUCETURE DOCUMENT
    getStructureDocumentOfUser: async (req, res, next) => {
        try {
            const userOwnId = parseInt(req.payload.aud);
            const userId = parseInt(req.params.userId)
            const folderId = req.query.folder;
            const groupId = req.params.groupId;

            const relation = await getStateRelation(userOwnId, userId)

            if (relation.includes("BLOCKED") || relation.includes("BLOCKING")) return next(createError(403))

            const privacies = [TypePrivacy.PUBLIC];

            if (relation.includes("FRIEND")) privacies.push(TypePrivacy.FRIENDS)

            let folders = [];
            if (groupId) {
                folders = await Folder.getAll({
                    where: {
                        groupId: parseInt(groupId),
                        from: UploadDocumentWhere.GROUP,
                        parentFolderId: parseInt(folderId) ?? null,
                    },
                    orderBy: {
                        title: "asc"
                    },
                })
            } else {
                folders = await prisma.folder.findMany({
                    where: {
                        ownerId: userId,
                        from: UploadDocumentWhere.USER,
                        parentFolderId: parseInt(folderId) ?? null,
                        privacy: {
                            in: privacies
                        }
                    },
                    orderBy: {
                        title: "asc"
                    }
                })
            }

            const folderStructure = folders.map(folder => {
                return {
                    type: "folder",
                    data: {
                        ...folder
                    },
                }
            })

            let files = [];
            if (groupId) {
                files = await File.getAll({
                    where: {
                        groupId: parseInt(groupId),
                        from: UploadDocumentWhere.GROUP,
                        folderId: parseInt(folderId) ?? null,

                    },
                    orderBy: {
                        title: "asc"
                    },
                })
            } else {
                files = await File.getAll({
                    where: {
                        ownerId: userId,
                        from: UploadDocumentWhere.USER,
                        folderId: parseInt(folderId) ?? null,
                        privacy: {
                            in: privacies
                        }
                    },
                    orderBy: {
                        title: "asc"
                    },
                })
            }


            const fileStructure = files.map(file => {
                return {
                    type: "file",
                    data: {
                        ...file
                    }
                }
            })


            res.status(200).json([
                ...folderStructure,
                ...fileStructure
            ])
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // UPDATE DOCUMENT
    updateFile: async (req, res, next) => {
        try {
            const { privacy, title } = req.body;

            const userIdReq = req.payload.aud;

            const fileId = req.params.fileId;

            if (!fileId) return next(createError(400, "file id is missing"))

            const oldFile = await File.get(fileId)

            if (oldFile.from == UploadDocumentWhere.MESSAGE) return createError(403)

            if (userIdReq != oldFile.ownerId && oldFile.from != UploadDocumentWhere.GROUP) return createError(403)

            let newFile = oldFile;

            const pathFileArray = oldFile.url.split("/");
            pathFileArray.shift();
            const pathFile = pathFileArray.join("/");

            if (title) {
                const newPathFile = pathFile.split("/").slice(0, -1).concat(title).join("/");
                const { result, filePath, fileName, fileType } = await updateFileGCS(pathFile, newPathFile);
                if (result) {
                    newFile = await File.model.update({
                        where: {
                            id: oldFile.id
                        },
                        data: {
                            title: fileName,
                            fileType: fileType,
                            privacy: privacy ?? oldFile.privacy,
                            url: filePath
                        },
                        include: {
                            owner: {
                                include: {
                                    userProfile: true
                                }
                            }
                        }
                    })
                } else return next(createError(500, "Update file failed"))
            } else {
                if (privacy) {
                    newFile = await File.model.update({
                        where: {
                            id: oldFile.id
                        },
                        data: {
                            privacy: privacy
                        },
                        include: {
                            owner: {
                                include: {
                                    userProfile: true
                                }
                            }
                        }
                    })
                }
            }



            return res.status(200).send(newFile)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // UPDATE DOCUMENT
    updateFolder: async (req, res, next) => {
        try {
            const { privacy, title } = req.body;

            const userIdReq = req.payload.aud;

            const folderId = req.params.folderId;

            if (!folderId) return next(createError(400, "file id is missing"))

            const oldFolder = await Folder.get(folderId)

            if (oldFolder.from == UploadDocumentWhere.MESSAGE) return createError(403)

            if (userIdReq != oldFolder.ownerId && oldFolder.from != UploadDocumentWhere.GROUP) return createError(403)

            let newFolder = oldFolder;

            const pathFolderArray = oldFolder.url.split("/");
            pathFolderArray.shift();
            const pathFolder = pathFolderArray.join("/");

            if (title) {
                const newFolderPath = pathFolder.split("/").slice(0, -1).concat(title).join("/");
                const { result, folderPath, folderName } = await updateFolderGCS(pathFolder, newFolderPath);
                if (result) {
                    newFolder = await Folder.model.update({
                        where: {
                            id: oldFolder.id
                        },
                        data: {
                            title: folderName,
                            privacy: privacy ?? oldFolder.privacy,
                            url: folderPath
                        },
                        include: {
                            owner: {
                                include: {
                                    userProfile: true
                                }
                            }
                        }
                    })
                } else return next(createError(500, "Update file failed"))

            } else {
                if (privacy) {
                    newFolder = await Folder.model.update({
                        where: {
                            id: oldFolder.id
                        },
                        data: {
                            privacy: privacy
                        },
                        include: {
                            owner: {
                                include: {
                                    userProfile: true
                                }
                            }
                        }
                    })
                }
            }

            return res.status(200).send(newFolder)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
}

