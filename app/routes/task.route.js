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
taskRoute.get("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submissions/class", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.getSubmissionClass)
taskRoute.get("/conversation/:conversationId/workspace/:workspaceId/members/class", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.getMemberTasksClass)


// ------ API update ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.updateTask)

// ------ API submission ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.submitTask)
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/class", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.submitTaskClass)

// ------ API preview task ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/preview", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.previewTask)
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/preview/class", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.previewTaskClass)


// ------ API publish task ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/publish", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.publishTask)

// ------ API add File ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/addfile", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.addFilesToSubmit)
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/addfile/class", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.addFilesToSubmitClass)

// ------ API update file ------- //
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/updatefile", verifyAccessToken, uploadMiddleware.single('file'), chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.updateFileSubmit)

// ------ API remove file --------//
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/removefile", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.deleteFileSubmit)
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/submission/removefile/class", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.deleteFileSubmitClass)

// ------ API get historry -------//
taskRoute.get("/conversation/:conversationId/workspace/:workspaceId/task/:taskId/history", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, taskController.getHistories)

// ------- API create annoucement --------//
taskRoute.post("/conversation/:conversationId/workspace/:workspaceId/announcement", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.createAnnouncement)

// ------- API update annoucement --------//
taskRoute.put("/conversation/:conversationId/workspace/:workspaceId/announcement/:announcementId", verifyAccessToken, uploadMiddleware.array('files'), chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.updateAnnouncement)

// ------ API delete task ------- //
taskRoute.delete("/conversation/:conversationId/workspace/:workspaceId/task/:taskId", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.deleteTask)

// ------ API delete announcement ------- //
taskRoute.delete("/conversation/:conversationId/workspace/:workspaceId/announcement/:announcementId", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, taskController.deleteAnnouncement)


module.exports = taskRoute;
