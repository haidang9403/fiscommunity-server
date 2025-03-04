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



                // Trả về URL công khai của file đã tải lên
                res.status(200).send({
                    success: true,
                    message: 'Tải file lên thành công!',
                    result,
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

            const replace = req.body.replace == 'false' ? false : true;
            const parentFolderId = parseInt(req.body.parentFolderId);
            let from = req.body.from ?? UploadDocumentWhere.USER;
            const groupId = req.params.groupId ? parseInt(req.params.groupId) : null;
            let privacy = req.body.privacy;
            if (!files) {
                return next(400, "No file uploaded.");
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
                    destUserFolder = `group-${group.id}/user-${userId}`
                    from = UploadDocumentWhere.GROUP
                }
            }

            const folder = req.body.folder;
            if (!folder) throw createError(400, "No folder to upload");

            if (parentFolderId) {
                const parentFolder = await Folder.get(parentFolderId);
                if (parentFolder) {
                    if (parentFolder.ownerId !== parseInt(userId)) {
                        return next(createError(403, "You do not have permission to delete this file"))
                    }


                    if (parentFolder.from == UploadDocumentWhere.MESSAGE) {
                        return next(createError(400, "Folder not valid to upload"))
                    }

                    if (parentFolder.from == UploadDocumentWhere.GROUP && !groupId) {
                        return next(createError(400, "Folder not valid to upload"))
                    }

                    if (groupId) {
                        if (parentFolder.groupId != groupId) {
                            return next(createError(404, "Folder not exist in group"))
                        }
                    }
                } else {
                    return next(createError(404, "Folder not exist"))
                }
            }


            let fullPathParentFolder;
            if (parentFolderId) {
                fullPathParentFolder = await Folder.getFullPathFolder(parentFolderId) + "/"
            }

            const destFolder = `${destUserFolder}/${fullPathParentFolder ?? ""}${folder}`
            console.log(replace)

            uploadFolderToGCS(files, destFolder, { replace }, async (err, { results, folder }) => {
                if (err) {
                    console.log(err)
                    return next(createError(500, "Error when uploading folder"))
                }

                const newFolder = new Folder({
                    title: folder.folderName,
                    url: folder.url,
                    size: parseFloat(folder.size),
                    ownerId: userId,
                    parentFolderId,
                    from,
                    groupId,
                    privacy
                });

                if (replace) {
                    const replaceFolder = await prisma.folder.findFirst({
                        where: {
                            title: folder.folderName,
                            parentFolderId,
                            ownerId: parseInt(userId),
                            groupId
                        }
                    })

                    if (replaceFolder) {
                        newFolder.updateId(replaceFolder.id);

                        await newFolder.deleteAllFiles();


                        results.forEach(async (result) => {
                            await prisma.file.create({
                                data: {
                                    title: result.fileName,
                                    url: result.url,
                                    size: parseFloat(result.size),
                                    from,
                                    ownerId: userId,
                                    groupId,
                                    folderId: replaceFolder.id
                                }
                            })
                        })

                        await newFolder.save()
                    } else {
                        const temp = await newFolder.save();


                        results.forEach(async (result) => {
                            await prisma.file.create({
                                data: {
                                    title: result.fileName,
                                    url: result.url,
                                    size: parseFloat(result.size),
                                    from,
                                    ownerId: userId,
                                    groupId,
                                    folderId: temp.id
                                }
                            })
                        })
                    }

                } else {
                    const temp = await newFolder.save();

                    results.forEach(async (result) => {
                        await prisma.file.create({
                            data: {
                                title: result.fileName,
                                url: result.url,
                                size: parseFloat(result.size),
                                from,
                                ownerId: userId,
                                groupId,
                                folderId: temp.id
                            }
                        })
                    })
                }

                const folderSuccess = await prisma.folder.findUnique({
                    where: {
                        id: parseInt(newFolder.id)
                    }
                })
                // Trả về URL công khai của file đã tải lên
                res.status(200).send(
                    folderSuccess);
            })

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

                    // Gửi phản hồi thành công sau khi xóa file thành công
                    return res.status(result.statusCode).send({
                        success: result.success,
                        message: result.message,
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

            const pathFolderArray = folder.url.split("/");
            pathFolderArray.shift();
            const pathFolder = pathFolderArray.join("/");

            deleteFolderFromGCS(pathFolder, async (error, result) => {
                if (error) {
                    return next(createError(500, "Error when delelte folder"));
                }

                try {
                    // If GCS deletion is successful, proceed with deleting files and folder in the database
                    const currentFolder = new Folder(folder.id);
                    await currentFolder.deleteAllFiles(folder.id);
                    await Folder.delete(folder.id);

                    // Only send the response here after everything is done
                    return res.status(result.statusCode).send({
                        success: result.success,
                        message: result.message,
                    });
                } catch (dbError) {
                    console.log(dbError);
                    return next(createError(500, "Error while deleting folder data from database"));
                }
            })
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
                        }
                    }
                })

                const isValid = fileDetails.taskSubmissions.some((task) =>
                    task.assignedUsers.some(user => user.userId == userId)
                )

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

