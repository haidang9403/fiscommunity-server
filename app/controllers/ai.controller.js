const createError = require("http-errors");
const config = require("../config");
const prisma = require("../services/prisma");
const createApi = require("../services/axios");
const { uploadFilesToGCS, uploadFileToGCS } = require("../utils/googleCloundStorage/upload.util");
const { UploadDocumentWhere, TypePrivacy } = require("@prisma/client");

const api = createApi("http://localhost:5678/webhook-test")

const aiController = {
    // Middle ware create ai
    checkAi: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const { conversationId } = req.body;

            const ai = await prisma.chatbot.upsert({
                where: {
                    userId
                },
                update: {},
                create: {
                    userId
                },
                include: {
                    conversation: true
                }
            })

            req.payload.ai = ai

            if (conversationId) {
                const conversation = await prisma.conversation.findFirst({
                    where: {
                        id: parseInt(conversationId),
                        chatbotId: ai.id
                    },
                    include: {
                        messages: {
                            where: {
                                senderId: userId
                            },
                            orderBy: {
                                createdAt: "desc"
                            },
                            take: 5,
                            include: {
                                messageReplies: true
                            }
                        },
                    }
                })

                if (!conversation) return next(createError(400))

                req.payload.aichat = conversation
            } else {
                const conversation = await prisma.conversation.create({
                    data: {
                        name: "Cuộc trò chuyện mới",
                        isChatbot: true,
                        chatbotId: ai.id,
                        admins: {
                            connect: [
                                {
                                    id: parseInt(userId)
                                }
                            ]
                        }
                    },
                    include: {
                        messages: true,
                    }
                })

                req.payload.aichat = conversation
            }

            next()

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    checkValidAi: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);

            const ai = await prisma.chatbot.upsert({
                where: {
                    userId
                },
                update: {},
                create: {
                    userId
                },
                include: {
                    conversation: true
                }
            })

            req.payload.ai = ai

            next()

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    checkValidConversation: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const ai = req.payload.ai;

            if (!conversationId) return next(createError(400, "Missing conversationId"))

            const conversation = await prisma.conversation.findFirst({
                where: {
                    id: parseInt(conversationId),
                    chatbotId: parseInt(ai.id)
                },
            })

            if (!conversation) return next(createError(404, "Conversation not found"))

            req.payload.aichat = conversation;

            next();

        } catch (e) {
            console.log(e);
            next(createError(500))
        }
    },
    // get list conversation
    getListConversation: async (req, res, next) => {
        try {
            const ai = req.payload.ai;

            const conversations = await prisma.conversation.findMany({
                where: {
                    chatbotId: parseInt(ai.id)
                },
                orderBy: {
                    createdAt: "desc"
                }
            })

            res.status(200).json(conversations)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // get chat on conversation
    getListMessage: async (req, res, next) => {
        try {
            const conversation = req.payload.aichat
            const { take, skip } = req.query;

            const messages = await prisma.message.findMany({
                where: {
                    conversationId: parseInt(conversation.id)
                },
                orderBy: {
                    createdAt: "desc"
                },
                take: take ? parseInt(take) : 10,
                skip: skip ? parseInt(skip) : 0
            })

            res.status(200).json(messages)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // chat on new conversation
    // chat on exist conversation
    chatToAi: async (req, res, next) => {
        try {
            const conversation = req.payload.aichat;
            const { body } = req.body;
            const userId = req.payload.aud;
            const files = req.files;

            if (!body) return next(createError(400))

            const message = await prisma.message.create({
                data: {
                    body,
                    conversationId: parseInt(conversation.id),
                    senderId: parseInt(userId),
                    type: "CHATBOT"
                },
                include: {
                    sender: {
                        include: {
                            userProfile: true
                        }
                    },
                    file: true,
                }
            })

            // call api chat ai agent
            const data = await api.post("/chat", {
                chatInput: body,
                conversaionId: conversation.id,
                messageId: message.id,
                messageHistories: conversation.messages,
                userId: userId
            });

            res.status(201).json(data.data)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    saveFile: async (req, res, next) => {
        try {
            //
            const file = req.file;
            // const { userId } = req.body;

            // if (!userId) return next(createError(403));

            return res.json({ image: file.path })
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // delete conversation

    // re chat ai

    // send ai message to user
    responseToUser: async (req, res, next) => {
        try {
            const { body, conversationId, messageId } = req.body;

            const message = await prisma.message.create({
                data: {
                    body,
                    conversationId: parseInt(conversationId),
                    type: "CHATBOT",
                    replyId: parseInt(messageId)
                },
                include: {
                    sender: {
                        include: {
                            userProfile: true
                        }
                    },
                    file: true,
                }
            })

            // socket to user

            res.status(200).json(message)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    updateTitleAi: async (req, res, next) => {
        try {
            const { title, conversationId, userId } = req.body;

            const name = title.replace(/"/g, '')

            const conversationUpdated = await prisma.conversation.update({
                where: {
                    id: parseInt(conversationId)
                },
                data: {
                    name
                }
            })

            if (!conversationUpdated) return next(createError(404))

            const io = req.app.get('socketio');

            io.to(`user_${userId}`).emit('conversation.update.name', conversationUpdated)

            res.status(200).json(conversationUpdated)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    }
}

module.exports = aiController