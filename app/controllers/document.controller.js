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


module.exports = {
    // UPLOAD FILE
    uploadFile: async (req, res, next) => {
        try {
            const userId = req.payload.aud;
            const file = req.file;
            const replace = req.body.replace ?? false;
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

                if (folder.from == UploadDocumentWhere.MESSAGE || folder.from == UploadDocumentWhere.GROUP) {
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
                    if (group.type == TypeGroup.PUBLIC) {
                        privacy = TypePrivacy.PUBLIC
                    } else if (group.type == TypeGroup.PRIVATE) {
                        privacy = TypePrivacy.PRIVATE_GROUP
                    }
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
            const replace = req.body.replace ?? false;
            const parentFolderId = parseInt(req.body.parentFolderId);
            let from = req.body.from ?? UploadDocumentWhere.USER;
            const groupId = req.params.groupId;
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
                    if (group.type == TypeGroup.PUBLIC) {
                        privacy = TypePrivacy.PUBLIC
                    } else if (group.type == TypeGroup.PRIVATE) {
                        privacy = TypePrivacy.PRIVATE_GROUP
                    }
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


                    if (parentFolder.from == UploadDocumentWhere.MESSAGE || parentFolder.from == UploadDocumentWhere.GROUP) {
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
                            ownerId: parseInt(userId)
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

                        results.forEach(async (result) => {
                            await prisma.file.create({
                                data: {
                                    title: result.fileName,
                                    url: result.url,
                                    size: parseFloat(result.size),
                                    from,
                                    ownerId: userId,
                                    groupId,
                                    folderId: newFolder.id
                                }
                            })
                        })

                        await newFolder.save();
                    }

                } else {
                    await newFolder.save();

                    results.forEach(async (result) => {
                        await prisma.file.create({
                            data: {
                                title: result.fileName,
                                url: result.url,
                                size: parseFloat(result.size),
                                from,
                                ownerId: userId,
                                groupId,
                                folderId: newFolder.id
                            }
                        })
                    })
                }


                // Trả về URL công khai của file đã tải lên
                res.status(200).send({
                    success: true,
                    message: 'Tải folder lên thành công!',
                    folder,
                    results,
                });
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
                if (error) {
                    return next(createError(500, "Error when delelte file"));
                }

                await File.delete(file.id);

                return res.status(result.statusCode).send({
                    success: result.success,
                    message: result.message,
                });
            })
        } catch (e) {
            next(e)
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

            if (!groupId && folder.groupId) {
                return next(createError(404, "Not permission to delete folder"))
            }

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
                return next(createError(403, "You do not have permission to delete this file"));
            }

            const pathFolderArray = folder.url.split("/");
            pathFolderArray.shift();
            const pathFolder = pathFolderArray.join("/");

            deleteFolderFromGCS(pathFolder, async (error, result) => {
                if (error) {
                    console.log(error);
                    return next(createError(500, "Error when delelte folder"));
                }

                await Folder.delete(folder.id);

                return res.status(result.statusCode).send({
                    success: result.success,
                    message: result.message,
                });
            })
        } catch (e) {
            next(e)
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
                        parentFolderId: parseInt(folderId) ?? null,
                    },
                    orderBy: {
                        title: "asc"
                    }
                })
            } else {
                folders = await Folder.getAll({
                    where: {
                        ownerId: userId,
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
                        ...folder,
                        size: folder.size.toString()
                    },
                }
            })

            const files = await File.getAll({
                where: {
                    ownerId: userId,
                    folderId: parseInt(folderId) ?? null,
                }
            })

            const fileStructure = files.map(file => {
                return {
                    type: "file",
                    data: {
                        ...file,
                        size: file.size.toString()
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
                return next(createError(403, "You do not have permission to download this file"));
            }

            const pathFileArray = file.url.split("/");
            pathFileArray.shift();
            const pathFile = pathFileArray.join("/");

            getFileFromGCS(pathFile, async (error, result) => {
                if (error) return next(createError(500, "Error when get file"));

                console.log(result)

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

            if (!folderId) throw createError(400, "No folder to delete");

            const folder = await Folder.get(folderId);
            if (!folder) throw createError(400, "Folder not exist")

            const groupId = req.params.groupId;

            if (!groupId && folder.groupId) {
                return next(createError(404, "Not permission to delete folder"))
            }

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
                return next(createError(403, "You do not have permission to delete this file"));
            }


            const pathFolderArray = folder.url.split("/");
            pathFolderArray.shift();
            const pathFolder = pathFolderArray.join("/");

            getFolderFromGCS(pathFolder, (error, result) => {
                if (error) {
                    res.status(500).send('Error creating zip file');
                    return;
                }

                if (result.message) {
                    res.status(404).send(result.message);
                    return;
                }

                // Tạo archive ZIP
                const archive = archiver('zip', { zlib: { level: 9 } });
                const stream = new PassThrough();

                const nameFolderZip = folder.title + Date.now() + ".zip";
                res.attachment(nameFolderZip);

                // Thêm các file vào archive
                result.fileList.forEach((file) => {
                    const fileStream = bucket.file(file).createReadStream();

                    const fileName = path.relative(pathFolder, file);
                    const folderName = folder.title + "/" + fileName;
                    archive.append(fileStream, { name: folderName });
                });

                archive.pipe(stream);
                archive.finalize();


                stream.pipe(res);
            });
        } catch (e) {
            next(e);
        }
    }
}