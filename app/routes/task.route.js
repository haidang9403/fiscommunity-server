const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const chatAccess = require("../security/chat.access.right");
const taskController = require("../controllers/task.controller");
const { uploadMiddleware } = require("../utils/googleCloundStorage/upload.util");


const taskRoute = express.Router();

// ------ API create ------- //
taskRoute.post("/conversation/:conversationId/workspace/:workspaceId", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.createTask)

// ------ API get ------- //
taskRoute.get("/conversation/:conversationId/workspace/:workspaceId", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.getList)

// ------ API update ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.updateTask)

// ------ API submission ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.submitTask)

// ------ API preview task ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/preview", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.previewTask)

// ------ API publish task ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/publish", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.publishTask)

// ------ API add File ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/addfile", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.addFilesToSubmit)

// ------ API update file ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/updatefile", verifyAccessToken, uploadMiddleware.single('file'), chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.updateFileSubmit)

// ------ API remove file --------//
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/removefile", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.deleteFileSubmit)

// ------ API get historry -------//
taskRoute.get("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/history", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.getHistories)

// ------- API create annoucement --------//
taskRoute.post("/conversation/:conversationId/workspace/:workspaceId/announcement", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.createAnnouncement)

// ------- API update annoucement --------//
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/announcement/:announcementId", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.updateAnnouncement)

// ------ API delete task ------- //
taskRoute.delete("/conversation/:conversationId/workspace/:workspaceId/task/:taskId", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.deleteTask)

// ------ API delete annoucement ------- //
taskRoute.delete("/conversation/:conversationId/workspace/:workspaceId/announcement/:announcementId", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.deleteAnnouncement)


module.exports = taskRoute;
