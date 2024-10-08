const createError = require("http-errors");
const Conversation = require("../models/chat/conversation.model");
const Message = require("../models/chat/message.model");
const { TypeMessage, UploadDocumentWhere } = require("@prisma/client");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary/delete.util");
const { uploadFileToGCS, uploadFolderToGCS } = require("../utils/googleCloundStorage/upload.util");
const File = require("../models/document/file.model");
const Folder = require("../models/document/folder.model");
const prisma = require("../services/prisma");
const { deleteFileFromGCS, deleteFolderFromGCS } = require("../utils/googleCloundStorage/delete.util");
const { response } = require("express");


const chatController = {
    //---- CREATE CONVERSATION WITH ONE PERSON----//
    createConversationOne: async (req, res, next) => {
        try {
            const userId = parseInt(req.params.userId);
            const currentUserId = parseInt(req.payload.aud);
            // Kiểm tra nếu đã có cuộc trò chuyện
            const existingConversation = await Conversation.findConversationBetweenUsers(currentUserId, userId);

            if (existingConversation) {
                return res.status(200).json(existingConversation);
            }

            // Tạo cuộc trò chuyện mới
            const conversation = new Conversation({
                name: "",
                userIds: [currentUserId, userId],
                adminIds: [currentUserId, userId],
                isGroup: false
            });

            const savedConversation = await conversation.save();

            res.status(200).json(savedConversation);
        } catch (error) {
            console.error(error);
            next(createError(500, "Error when create conversation"))
        }
    },
    //---- CREATE CONVERSATION GROUP----//
    createConversationGroup: async (req, res, next) => {
        try {
            const userIds = req.body.userIds;
            const currentUserId = parseInt(req.payload.aud);
            const name = req.body.name;

            if (userIds.length < 3) return next(createError(404, "Ít nhất 3 người để tạo nhóm"))

            for (const userId of userIds) {
                const user = await prisma.user.findUnique({
                    where: {
                        id: parseInt(userId)
                    }
                })

                if (!user) return next(createError(404, "User not found"))
            }

            // Tạo cuộc trò chuyện mới
            const conversation = await Conversation.createGroup({
                name,
                userIds,
                adminIds: [currentUserId]
            });

            res.status(200).json(conversation);
        } catch (error) {
            console.error(error);
            next(createError(500, "Error when create conversation"))
        }
    },
    //---- ADD MEMBER CONVERSATION GROUP----//
    addMemberConversation: async (req, res, next) => {
        try {
            const userIds = req.body.userIds;
            const currentUserId = parseInt(req.payload.aud);
            const conversationId = req.params.conversationId;

            for (const userId of userIds) {
                const user = await prisma.user.findUnique({
                    where: {
                        id: parseInt(userId)
                    }
                })

                if (!user) return next(createError(404, "User not found"))
            }


            const addmemberConversation = await Conversation.addMembers(conversationId, userIds);

            res.status(200).json(addmemberConversation);
        } catch (error) {
            console.error(error);
            next(createError(500, "Error when create conversation"))
        }
    },
    //---- REMOVE MEMBER CONVERSATION GROUP----//
    removeMemberConversation: async (req, res, next) => {
        try {
            const userIds = req.body.userIds;
            const currentUserId = parseInt(req.payload.aud);
            const conversationId = req.params.conversationId;

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId)
                },
                include: {
                    user: true
                }
            })

            for (const userId of userIds) {
                const user = await prisma.user.findUnique({
                    where: {
                        id: parseInt(userId)
                    }
                })

                if (!user) return next(createError(404, "User not found"))
                if (user.id == currentUserId) return next(createError(400, "Can not delete current user"))
                const userExists = conversation.user.some(existingUser => existingUser.id === parseInt(userId));
                if (!userExists) return next(createError(400, "User not in group"))
            }


            const conversationUpdated = await Conversation.removeMember(conversationId, userIds);

            res.status(200).json(conversationUpdated);
        } catch (error) {
            console.error(error);
            next(createError(500, "Error when create conversation"))
        }
    },
    //---- EXIT CONVERSATION GROUP----//
    exitConversationGroup: async (req, res, next) => {
        try {
            const currentUserId = parseInt(req.payload.aud);
            const conversationId = req.params.conversationId;

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId)
                },
                include: {
                    user: true
                }
            })

            const userExists = conversation.user.some(existingUser => existingUser.id === parseInt(currentUserId));
            if (!userExists) return next(createError(400, "User not in group"))


            const conversationUpdated = await Conversation.removeMember(conversationId, [currentUserId]);

            if (conversationUpdated.user.length == 0) {
                await Conversation.model.delete({
                    where: {
                        id: conversationUpdated.id
                    }
                })

                return res.status(200).json({
                    message: "Exit successfull!"
                })
            }

            let conversationUpdateAdmin;

            if (conversationUpdated.admins.length == 0) {
                const adminIds = [conversationUpdated.user[0].id]
                conversationUpdateAdmin = await Conversation.addAdmin(conversation, adminIds)
            }

            res.status(200).json(conversationUpdateAdmin);
        } catch (error) {
            console.error(error);
            next(createError(500, "Error when create conversation"))
        }
    },
    //---- ADD ADMIN CONVERSATION GROUP----//
    addAdminConversation: async (req, res, next) => {
        try {
            const userIds = req.body.userIds;
            const currentUserId = parseInt(req.payload.aud);
            const conversationId = req.params.conversationId;

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId)
                },
                include: {
                    user: true,
                    admins: true
                }
            })

            let adminIds = []

            for (const userId of userIds) {
                const user = await prisma.user.findUnique({
                    where: {
                        id: parseInt(userId)
                    }
                })

                if (!user) return next(createError(404, "User not found"))
                if (user.id == currentUserId) return next(createError(400, "Can not add current user"))
                const userExists = conversation.user.some(existingUser => existingUser.id === parseInt(userId));
                if (!userExists) return next(createError(400, "User not in group"))
                adminIds.push(userId)
            }


            const conversationUpdated = await Conversation.addAdmin(conversationId, adminIds);

            res.status(200).json(conversationUpdated);
        } catch (error) {
            console.error(error);
            next(createError(500, "Error when create conversation"))
        }
    },
    //---- UPDATE CONVERSATION ----//
    updateConversation: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const updateData = req.body;
            const updatedConversation = await Conversation.updateConversation(conversationId, updateData);

            if (!updatedConversation) {
                return next(createError(404, "Conversation not found"))
            }

            res.status(200).json(updatedConversation);
        } catch (error) {
            console.error(error);
            return next(createError(500, "Error when updating conversation"))
        }
    },
    //---- UPDATE CONVERSATION ----//
    deleteConversation: async (req, res, next) => {
        try {
            const { conversationId } = req.params;

            const conversationDeleted = await Conversation.model.delete({
                where: {
                    id: parseInt(conversationId)
                }
            })

            res.status(200).json(conversationDeleted);
        } catch (error) {
            console.error(error);
            return next(createError(500, "Error when deleting conversation"))
        }
    },
    //---- SEND TEXT MESSAGE ----//
    sendTextMessage: async (req, res, next) => {
        try {
            const { conversationId } = req.params
            const senderId = req.payload.aud;
            const body = req.body.body;
            if (!body) return next(404, "Body message not found")

            const type = TypeMessage.TEXT;

            const newMessage = new Message({
                body,
                conversationId,
                senderId,
                type
            })

            const messageSaved = await newMessage.save();

            res.status(200).json(messageSaved);
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when sending message"))
        }
    },
    //---- SEND IMAGE MESSAGE ----//
    sendMediaMessage: async (req, res, next) => {
        try {
            const { conversationId } = req.params
            const senderId = req.payload.aud;

            const type = TypeMessage.MEDIA;

            const medias = req.files;
            if (medias.length < 1) return next(createError(404, "Media error when upload media"))

            const url = medias.map((media) => media.path).join("|");

            // const conversation = await Conversation.model.findUnique({
            //     where: {
            //         id: parseInt(conversationId)
            //     }
            // })

            const newMessage = new Message({
                conversationId,
                senderId,
                type,
                url
            })

            const messageSaved = await newMessage.save();

            // const size = medias.reduce((totalSize, media) => totalSize += parseInt(Math.ceil(media.size / (1024 * 1024))), 0)

            // if (parseInt(conversation.totalStorage) + parseInt(size) > parseInt(conversation.limitStorage)) {
            //     let result;
            //     for (const media of media) {
            //         result = await deleteMediaFromCloudinary(media);
            //     }

            //     if (result !== 'ok') {

            //         await Message.model.delete({
            //             where: {
            //                 id: messageSaved.id
            //             }
            //         })

            //         return next(createError(500, "Error when delete media"))
            //     }


            // }

            // await Conversation.model.update({
            //     where: {
            //         id: parseInt(conversationId)
            //     },
            //     data: {
            //         totalStorage: parseInt(conversation.totalStorage) + parseInt(size)
            //     }
            // })

            res.status(200).json(messageSaved);
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when sending message"))
        }
    },
    //---- SEND FILE MESSAGE ----//
    sendFileMessage: async (req, res, next) => {
        try {
            const { conversationId } = req.params
            const senderId = req.payload.aud;

            const type = TypeMessage.FILE;

            const file = req.file;
            if (!file) return next(createError(404, "Not file to upload"))

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId)
                }
            })

            const now = Date.now();

            let destFolder = `conversation-${conversationId}/${now}`;



            uploadFileToGCS(file.buffer, file.originalname, destFolder, { replace: false }, async (err, result) => {
                if (err) {
                    console.log(err);
                    return next(createError(500, "Error when upload file"));
                }

                const newFile = new File({
                    title: result.fileName + "|" + now,
                    url: result.url,
                    size: parseFloat(result.size),
                    from: UploadDocumentWhere.MESSAGE,
                    ownerId: parseInt(senderId),
                })

                const fileSaved = await newFile.save();

                const newMessage = new Message({
                    conversationId,
                    senderId,
                    type,
                    fileId: fileSaved.id
                })

                const messageSaved = await newMessage.save();

                const size = (file.size / (1024 * 1024)).toFixed(4)

                if (parseFloat(conversation.totalStorage) + parseFloat(size) > parseFloat(conversation.limitStorage)) {
                    let result;
                    for (const media of media) {
                        result = await deleteMediaFromCloudinary(media);
                    }

                    if (result !== 'ok') {

                        await Message.model.delete({
                            where: {
                                id: messageSaved.id
                            }
                        })

                        return next(createError(500, "Error when rollback file"))
                    }
                }

                await Conversation.model.update({
                    where: {
                        id: parseInt(conversationId)
                    },
                    data: {
                        totalStorage: parseFloat(conversation.totalStorage) + parseFloat(size)
                    }
                })

                res.status(200).send(messageSaved);
            })
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when sending message"))
        }
    },
    //---- SEND FOLDER MESSAGE ----//
    sendFolderMessage: async (req, res, next) => {
        try {
            const { conversationId } = req.params
            const senderId = req.payload.aud;

            const type = TypeMessage.FOLDER;

            const files = req.files;
            if (files.length == 0) return next(createError(404, "No folder to upload"))

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId)
                }
            })

            const folder = req.body.folder;
            if (!folder) throw createError(400, "No folder to upload");

            const now = Date.now();

            let destFolder = `conversation-${conversationId}/${now}/${folder}`;



            uploadFolderToGCS(files, destFolder, { replace: false }, async (err, { results, folder }) => {
                if (err) {
                    console.log(err);
                    return next(createError(500, "Error when upload folder"));
                }

                const newFolder = new Folder({
                    title: folder.folderName + "|" + now,
                    url: folder.url,
                    size: parseFloat(folder.size),
                    from: UploadDocumentWhere.MESSAGE,
                    ownerId: parseInt(senderId),
                })

                const folderSaved = await newFolder.save();

                for (const result of results) {
                    await prisma.file.create({
                        data: {
                            title: result.fileName,
                            url: result.url,
                            size: parseFloat(result.size),
                            from: UploadDocumentWhere.MESSAGE,
                            ownerId: parseInt(senderId),
                            folderId: folderSaved.id
                        }
                    })
                }

                const newMessage = new Message({
                    conversationId,
                    senderId,
                    type,
                    folderId: folderSaved.id
                })

                const messageSaved = await newMessage.save();

                const size = (folderSaved.size / (1024 * 1024)).toFixed(4)

                if (parseFloat(conversation.totalStorage) + parseFloat(size) > parseFloat(conversation.limitStorage)) {
                    let result;
                    for (const media of media) {
                        result = await deleteMediaFromCloudinary(media);
                    }

                    if (result !== 'ok') {

                        await Message.model.delete({
                            where: {
                                id: messageSaved.id
                            }
                        })

                        return next(createError(500, "Error when rollback mesage"))
                    }
                }

                await Conversation.model.update({
                    where: {
                        id: parseInt(conversationId)
                    },
                    data: {
                        totalStorage: parseFloat(conversation.totalStorage) + parseFloat(size)
                    }
                })

                res.status(200).send(messageSaved);
            })
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when sending message"))
        }
    },
    //---- HARD DELETE MESSAGE ----//
    hardDeleteMessage: async (req, res, next) => {
        try {
            const messageId = req.params.messageId;
            const { conversationId } = req.params

            const message = await Message.model.findUnique({
                where: {
                    id: parseInt(messageId)
                },
                include: {
                    file: true,
                    folder: true
                }
            })

            if (!message) return next(createError(404, "Message not found"))

            let document;

            if (message.type == TypeMessage.FILE) {
                document = message.file
            } else if (message.type == TypeMessage.FOLDER) {
                document = message.folder
            } else {
                return next(createError(400, "Can not hard delete"))
            }

            if (!document) return next(createError(400, "No document to hard delete"))

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId)
                }
            })

            const pathArray = document.url.split("/");
            pathArray.shift();
            const path = pathArray.join("/");

            if (message.type == TypeMessage.FILE) {
                deleteFileFromGCS(path, async (error, result) => {
                    if (error) {
                        return next(createError(500, "Error when delelte file"));
                    }

                    await File.delete(document.id);

                    // Update size when deleting success
                    await Conversation.model.update({
                        where: {
                            id: parseInt(conversationId)
                        },
                        data: {
                            totalStorage: parseFloat((parseFloat(conversation.totalStorage) - parseFloat(document.size)).toFixed(4))
                        }
                    })

                    return res.status(result.statusCode).send({
                        success: result.success,
                        message: result.message,
                    });
                })
            } else if (message.type == TypeMessage.FOLDER) {
                deleteFolderFromGCS(path, async (error, result) => {
                    if (error) {
                        console.log(error);
                        return next(createError(500, "Error when delelte folder"));
                    }

                    await Folder.delete(document.id);

                    // Update size when deleting success
                    await Conversation.model.update({
                        where: {
                            id: parseInt(conversationId)
                        },
                        data: {
                            totalStorage: parseFloat((parseFloat(conversation.totalStorage) - parseFloat(document.size)).toFixed(4))
                        }
                    })

                    return res.status(result.statusCode).send({
                        success: result.success,
                        message: result.message,
                    });
                })
            }

        } catch (e) {
            console.log(e)
            next(createError(500, "Error when deleting message"))
        }
    },
    //---- DELETE MESSAGE ----//
    deleteMessage: async (req, res, next) => {
        try {
            const messageId = req.params.messageId;

            const message = await Message.model.findUnique({
                where: {
                    id: parseInt(messageId)
                },
            })

            if (!message) return next(createError(404, "Message not found"))
            if (message.type == TypeMessage.FILE || message.type == TypeMessage.FOLDER) {
                return next(createError(400, "This message just hard delete"))
            }

            const messageDeleted = await Message.model.update({
                where: {
                    id: parseInt(messageId)
                },
                data: {
                    deleted: true
                }
            })

            res.status(200).json(messageDeleted)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when deleting message"))
        }
    },
    //---- UNSEND MESSAGE ----//
    unsendMessage: async (req, res, next) => {
        try {
            const messageId = req.params.messageId;

            const message = await Message.model.findUnique({
                where: {
                    id: parseInt(messageId)
                },
            })

            if (!message) return next(createError(404, "Message not found"))
            if (message.type == TypeMessage.FILE || message.type == TypeMessage.FOLDER) {
                return next(createError(400, "This message just hard delete"))
            }

            const messageDeleted = await Message.model.update({
                where: {
                    id: parseInt(messageId)
                },
                data: {
                    type: TypeMessage.UN_SEND,
                    folderId: null,
                    fileId: null,
                    postId: null,
                }
            })

            res.status(200).json(messageDeleted)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when deleting message"))
        }
    },
    //---- SEEN MESSAGE ----//
    seenMeesage: async (req, res, next) => {
        try {
            const messageId = req.params.messageId;
            const userId = req.payload.aud;

            const messageSeen = await Message.model.update({
                where: {
                    id: parseInt(messageId)
                },
                data: {
                    seens: {
                        connect: {
                            id: parseInt(userId)
                        }
                    }
                },
                include: {
                    seens: true
                }
            })

            if (!messageSeen) return next(createError(404, "Message not found"))

            res.status(200).json(messageSeen)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when deleting message"))
        }
    },
}

module.exports = chatController