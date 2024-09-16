const createError = require("http-errors");
const { uploadFileToGCS, uploadFolderToGCS } = require("../utils/googleCloundStorage/upload.util");
const prisma = require("../services/prisma");
// const { updateSizeParentFolder } = require("../utils/helper.util");
const Folder = require("../models/folder.model");
const File = require("../models/file.model");
const { deleteFileFromGCS, deleteFolderFromGCS } = require("../utils/googleCloundStorage/delete.util");

module.exports = {
    // UPLOAD FILE
    uploadFile: async (req, res, next) => {
        try {
            const userId = req.payload.aud;
            const file = req.file;
            const replace = req.body.replace ?? false;
            const ofGroup = req.body.ofGroup ?? false;
            const groupId = req.body.groupId;
            const folderId = parseInt(req.body.folderId);
            if (!file) {
                throw createError(400, "No file uploaded.");
            }

            const folder = await Folder.get(folderId);
            if (folder) {
                if (parseInt(folder.ownerId) !== parseInt(userId)) {
                    throw createError(403, "You do not have permission to upload this file");
                }
            }


            const destUserFolder = `user-${userId}`;

            let fullPathFolder;
            if (folderId) {
                fullPathFolder = await Folder.getFullPathFolder(folderId)
            }
            const destFolder = `${fullPathFolder ? destUserFolder + "/" + fullPathFolder : destUserFolder}`

            uploadFileToGCS(file.buffer, file.originalname, destFolder, { replace }, async (err, result) => {
                if (err) {
                    throw createError(500, "Error when upload file");
                }

                const newFile = new File({
                    title: result.fileName,
                    url: result.url,
                    size: BigInt(result.size),
                    ofGroup,
                    ownerId: parseInt(userId),
                    groupId,
                    folderId
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
            next(e);
        }
    },
    // UPLOAD FOLDER
    uploadFolder: async (req, res, next) => {
        try {
            const userId = req.payload.aud;
            const files = req.files;
            const replace = req.body.replace ?? false;
            const parentFolderId = parseInt(req.body.parentFolderId);
            const ofGroup = req.body.ofGroup;
            const groupId = req.body.groupId;
            if (!files) {
                throw createError(400, "No file uploaded.");
            }

            const destUserFolder = `user-${userId}`;
            const folder = req.body.folder;
            if (!folder) throw createError(400, "No folder to upload");

            const parentFolder = await Folder.get(parentFolderId);
            if (parentFolder) {
                if (parentFolder.ownerId !== parseInt(userId)) {
                    throw createError(403, "You do not have permission to delete this file");
                }
            }


            let fullPathParentFolder;
            if (parentFolderId) {
                fullPathParentFolder = await Folder.getFullPathFolder(parentFolderId) + "/"
            }
            const destFolder = `${destUserFolder}/${fullPathParentFolder ?? ""}${folder}`
            uploadFolderToGCS(files, destFolder, { replace }, async (err, { results, folder }) => {
                if (err) {
                    throw createError(500, "Error when upload file");
                }

                const newFolder = new Folder({
                    title: folder.folderName,
                    url: folder.url,
                    size: BigInt(folder.size),
                    ownerId: userId,
                    parentFolderId,
                    ofGroup,
                    groupId
                });

                if (replace) {
                    const replaceFolder = await prisma.folder.findFirst({
                        where: {
                            title: folder.folderName,
                            parentFolderId
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
                                    size: BigInt(result.size),
                                    ofGroup,
                                    ownerId: userId,
                                    groupId,
                                    folderId: replaceFolder.id
                                }
                            })
                        })

                        await newFolder.save()

                    } else {
                        await newFolder.save();

                        results.forEach(async (result) => {
                            await prisma.file.create({
                                data: {
                                    title: result.fileName,
                                    url: result.url,
                                    size: BigInt(result.size),
                                    ofGroup,
                                    ownerId: userId,
                                    groupId,
                                    folderId: newFolder.id
                                }
                            })
                        })
                    }

                } else {
                    await newFolder.save();

                    results.forEach(async (result) => {
                        await prisma.file.create({
                            data: {
                                title: result.fileName,
                                url: result.url,
                                size: BigInt(result.size),
                                ofGroup,
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
            next(e);
        }
    },
    // DELETE FILE
    deleteFile: async (req, res, next) => {
        try {
            const fileId = req.params.fileId;
            const userId = parseInt(req.payload.aud);
            if (!fileId) throw createError(400, "No file to delete");

            const file = await File.get(fileId);
            if (!file) throw createError(400, "File not exist")

            if (file.ownerId !== userId) {
                throw createError(403, "You do not have permission to delete this file");
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

            if (folder.ownerId !== userId) {
                throw createError(403, "You do not have permission to upload this folder");
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
    }
}