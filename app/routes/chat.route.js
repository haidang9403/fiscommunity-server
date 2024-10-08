const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const chatController = require("../controllers/chat.controller");
const { uploadMediaToCloudinary } = require("../utils/cloudinary/upload.util");
const { uploadMiddleware } = require("../utils/googleCloundStorage/upload.util");
const chatAccess = require("../security/chat.access.right");

const chatRoute = express.Router();

// ------------ API Chat --------------- //

//--- Create conversation with one person
chatRoute.post("/conversation/user/:userId", verifyAccessToken, chatController.createConversationOne)

//--- Update conversation
chatRoute.put("/conversation/:conversationId", verifyAccessToken, chatAccess.roleAdmin, chatController.updateConversation)

//--- Delete conversation
chatRoute.delete("/conversation/:conversationId", verifyAccessToken, chatAccess.roleAdmin, chatController.deleteConversation)

//--- Chat message text
chatRoute.post("/conversation/:conversationId/message", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.relation, chatController.sendTextMessage)

//--- Chat message media
chatRoute.post("/conversation/:conversationId/message/media", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.relation, uploadMediaToCloudinary.array("media"), chatController.sendMediaMessage)

//--- Chat message file
chatRoute.post("/conversation/:conversationId/message/file", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.relation, uploadMiddleware.single('file'), chatController.sendFileMessage)

//--- Chat message folder
chatRoute.post("/conversation/:conversationId/message/folder", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.relation, uploadMiddleware.array('files'), chatController.sendFolderMessage)

//--- Seen message
chatRoute.post("/conversation/:conversationId/message/:messageId/seen", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.checkValidMesage, chatController.seenMeesage)

//--- Delete message
chatRoute.delete("/conversation/:conversationId/message/:messageId/delete", verifyAccessToken, chatAccess.message, chatController.deleteMessage)

//--- Unsend message
chatRoute.delete("/conversation/:conversationId/message/:messageId/retrieve", verifyAccessToken, chatAccess.message, chatController.unsendMessage)

//--- Hard delete message
chatRoute.delete("/conversation/:conversationId/message/:messageId/hard-delete", verifyAccessToken, chatAccess.message, chatController.hardDeleteMessage)

// ------------ API Chat Group --------------- //

//--- Create conversation group
chatRoute.post("/conversation/group", verifyAccessToken, chatController.createConversationGroup)

// --- Delete conversation group
chatRoute.delete("/conversation/:conversationId/group", verifyAccessToken, chatAccess.roleAdmin, chatController.deleteConversation)

//--- Addmember to group
chatRoute.put("/conversation/:conversationId/add-member", verifyAccessToken, chatAccess.checkValidConversationGroup, chatController.addMemberConversation)

//--- Removemember from group
chatRoute.delete("/conversation/:conversationId/remove-member", verifyAccessToken, chatAccess.roleAdmin, chatController.removeMemberConversation)

//--- Add admin group
chatRoute.put("/conversation/:conversationId/add-admin", verifyAccessToken, chatAccess.roleAdmin, chatController.addAdminConversation)

//--- Exit group
chatRoute.delete("/conversation/:conversationId/exit", verifyAccessToken, chatAccess.checkValidConversationGroup, chatController.exitConversationGroup)


module.exports = chatRoute;