const createError = require("http-errors");
const Conversation = require("../models/chat/conversation.model");
const Message = require("../models/chat/message.model");
const UserRelation = require("../models/users/user.relation.model");
const prisma = require("../services/prisma");

const chatAccess = {
    //------- CHECK VALID CONVERSATION ------//
    checkValidConversation: async (req, res, next) => {
        try {
            const conversationId = req.params.conversationId;
            const userId = req.payload.aud;
            if (!conversationId) return next(createError(404, "Conversation params not found"))

            const conversation = await prisma.conversation.findUnique({
                where: {
                    id: parseInt(conversationId)
                },
                include: {
                    user: true,
                    admins: true
                }
            })

            if (!conversation) return next(createError(404, "Conversation not found"))

            const userExists = conversation.user.some(existingUser => existingUser.id === parseInt(userId));

            if (!userExists) return next(createError(400, "User not in conversation"))

            req.conversation = conversation
            return next()
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when access post"))
        }
    },
    //------- CHECK VALID CONVERSATION GROUP ------//
    checkValidConversationGroup: async (req, res, next) => {
        try {
            const conversationId = req.params.conversationId;
            const userId = parseInt(req.payload.aud)
            if (!conversationId) return next(createError(404, "Conversation params not found"))

            const conversation = await Conversation.model.findFirst({
                where: {
                    id: parseInt(conversationId),
                    isGroup: true
                },
                include: {
                    user: true,
                    admins: true
                }
            })

            if (!conversation) return next(createError(404, "Conversation not found"))

            const userExists = conversation.user.some((user) => userId == user.id)
            if (!userExists) return next(createError(400, "User not in conversation"))

            req.conversation = conversation
            return next()
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when access post"))
        }
    },
    //------- CHECK VALID MESSAGE ------//
    checkValidMesage: async (req, res, next) => {
        try {
            const conversationId = req.params.conversationId;
            const messageId = req.params.messageId
            if (!conversationId) return next(createError(404, "Conversation params not found"))
            if (!messageId) return next(createError(404, "Message params not found"))

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId)
                }
            })

            if (!conversation) return next(createError(404, "Conversation not found"))

            const message = await Message.model.findFirst({
                where: {
                    id: parseInt(messageId),
                    conversationId: conversation.id
                }
            })

            if (!message) return next(createError(404, "Message not found or not in conversation"))

            return next()
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when access post"))
        }
    },
    //------- ROLE ADIM ------//
    roleAdmin: async (req, res, next) => {
        try {
            let conversationId
            let conversation = req.conversation
            const userId = req.payload.aud;

            if (!conversation) {
                conversationId = req.params.conversationId;

                if (!conversationId) return next(createError(404, "Conversation params not found"))

                conversation = await Conversation.model.findUnique({
                    where: {
                        id: parseInt(conversationId)
                    },
                    include: {
                        user: true,
                        admins: true
                    }
                })
            }

            if (!conversation) return next(createError(404, "Conversation not found"))

            const isAdmin = conversation.admins.some(existingUser => existingUser.id === parseInt(userId));
            if (!isAdmin) return next(createError(403, "Not permission to access conversation"))

            return next()
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when access post"))
        }
    },
    // CHECK MEMBER CONVERSATION
    roleMember: async (req, res, next) => {
        try {
            let conversationId
            let conversation = req.conversation
            const userId = req.payload.aud;

            if (!conversation) {
                conversationId = req.params.conversationId;

                if (!conversationId) return next(createError(404, "Conversation params not found"))

                conversation = await Conversation.model.findUnique({
                    where: {
                        id: parseInt(conversationId)
                    },
                    include: {
                        user: true,
                        admins: true
                    }
                })
            }

            if (!conversation) return next(createError(404, "Conversation not found"))

            const isMember = conversation.user.some(existingUser => existingUser.id === parseInt(userId));
            if (!isMember) return next(createError(403, "Not permission to access conversation"))

            return next()
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when access post"))
        }
    },
    //------- OWN MESSAGE ------//
    message: async (req, res, next) => {
        try {
            const conversationId = req.params.conversationId;
            const messageId = req.params.messageId;
            const userId = parseInt(req.payload.aud);
            if (!conversationId) return next(createError(404, "Conversation params not found"))
            if (!messageId) return next(createError(404, "Message params not found"))

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId)
                }
            })

            if (!conversation) return next(createError(404, "Conversation not found"))

            const message = await Message.model.findFirst({
                where: {
                    id: parseInt(messageId),
                    conversationId: conversation.id
                }
            })

            if (!message) return next(createError(404, "Message not found or not in conversation"))

            if (message.senderId != userId) return next(createError(403, "No permission to access message"))

            return next()
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when access post"))
        }
    },
    relation: async (req, res, next) => {
        try {
            const conversationId = req.params.conversationId;
            const userId = parseInt(req.payload.aud);
            if (!conversationId) return next(createError(404, "Conversation params not found"))

            const conversation = await Conversation.model.findUnique({
                where: {
                    id: parseInt(conversationId),
                },
                include: {
                    user: true
                }
            })

            if (!conversation) return next(createError(404, "Conversation not found"))

            if (conversation.isGroup) {
                // const otherUsers = conversation.user.filter((user) => user.id != userId)
                // let isBlocked = false;

                // for (const user of otherUsers) {
                //     isBlocked = await UserRelation.isBlocked(userId, user.id)
                // }

                // if (isBlocked) 
                return next()
            } else {
                const otherUser = conversation.user.filter((user) => user.id != userId).pop()

                const isBlocked = await UserRelation.isBlocked(userId, otherUser.id)

                console.log(isBlocked)

                if (isBlocked) return next(createError(403, "User relation is blocked"))
            }

            return next()
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when access post"))
        }
    },
}

module.exports = chatAccess