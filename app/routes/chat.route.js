const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const chatController = require("../controllers/chat.controller");
const { uploadMediaToCloudinary } = require("../utils/cloudinary/upload.util");
const { uploadMiddleware } = require("../utils/googleCloundStorage/upload.util");
const chatAccess = require("../security/chat.access.right");

const chatRoute = express.Router();

// ------------ API Chat --------------- //
//--- Get conversation of user
chatRoute.get("/conversation", verifyAccessToken, chatController.getConversation)
chatRoute.get("/conversation/:conversationId/one", verifyAccessToken, chatController.getOneConversation)
chatRoute.get("/info/conversation", verifyAccessToken, chatController.getInfoConversation)

chatRoute.get("/conversation/:conversationId", verifyAccessToken, chatController.getMessages)
chatRoute.get("/conversation/:conversationId/media", verifyAccessToken, chatController.getMessageMedia)
chatRoute.get("/conversation/:conversationId/file", verifyAccessToken, chatController.getMessageFiles)


//--- Create conversation with one person
chatRoute.post("/conversation/user/:userId", verifyAccessToken, chatController.createConversationOne)

//--- Update conversation -- socket
chatRoute.put("/conversation/:conversationId", verifyAccessToken, chatAccess.roleAdmin, chatController.updateConversation)

//--- Delete conversation -- socket
chatRoute.delete("/conversation/:conversationId", verifyAccessToken, chatAccess.roleAdmin, chatController.deleteConversation)

//--- Chat message text -- socket
chatRoute.post("/conversation/:conversationId/message", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.relation, chatController.sendTextMessage)

//--- Chat message media -- socket
chatRoute.post("/conversation/:conversationId/message/media", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.relation, uploadMediaToCloudinary.array("media"), chatController.sendMediaMessage)

//--- Chat message file -- socket
chatRoute.post("/conversation/:conversationId/message/file", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.relation, uploadMiddleware.single('file'), chatController.sendFileMessage)

//--- Chat message folder -- socket
chatRoute.post("/conversation/:conversationId/message/folder", verifyAccessToken, chatAccess.checkValidConversation, chatAccess.relation, uploadMiddleware.array('files'), chatController.sendFolderMessage)

//--- Seen message -- socket
chatRoute.post("/conversation/:conversationId/seen", verifyAccessToken, chatAccess.checkValidConversation, chatController.seenMeesage)

//--- Delete message 
chatRoute.delete("/conversation/:conversationId/message/:messageId/delete", verifyAccessToken, chatAccess.message, chatController.deleteMessage)

//--- Unsend message -- socket
chatRoute.delete("/conversation/:conversationId/message/:messageId/retrieve", verifyAccessToken, chatAccess.message, chatController.unsendMessage)

//--- Hard delete message -- socket
chatRoute.delete("/conversation/:conversationId/message/:messageId/hard-delete", verifyAccessToken, chatAccess.message, chatController.hardDeleteMessage)

// ------------ API Chat Group --------------- //

//--- Create conversation group -- socket
chatRoute.post("/conversation/group", verifyAccessToken, chatController.createConversationGroup)

// --- Delete conversation group -- socket
chatRoute.delete("/conversation/:conversationId/group", verifyAccessToken, chatAccess.roleAdmin, chatController.deleteConversation)

//--- Addmember to group -- socket
chatRoute.put("/conversation/:conversationId/add-member", verifyAccessToken, chatAccess.checkValidConversationGroup, chatController.addMemberConversation)

//--- Removemember from group -- socket
chatRoute.delete("/conversation/:conversationId/remove-member", verifyAccessToken, chatAccess.roleAdmin, chatController.removeMemberConversation)

//--- Add admin group -- socket
chatRoute.put("/conversation/:conversationId/add-admin", verifyAccessToken, chatAccess.roleAdmin, chatController.addAdminConversation)

//--- Exit group -- socket
chatRoute.delete("/conversation/:conversationId/exit", verifyAccessToken, chatAccess.checkValidConversationGroup, chatController.exitConversationGroup)


module.exports = chatRoute;