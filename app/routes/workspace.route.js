const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const chatAccess = require("../security/chat.access.right");
const workspaceController = require("../controllers/workspace.controller");

const workspaceRoute = express.Router();

// ------ API create ------- //
workspaceRoute.post("/conversation/:conversationId/workspace", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, workspaceController.create)

// ------ API get ------- //
workspaceRoute.get("/conversation/:conversationId/workspace", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleMember, workspaceController.getList)

// ------ API update ------- //
workspaceRoute.put("/conversation/:conversationId/workspace/:workspaceId", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, workspaceController.edit)

// ------ API close ------- //
workspaceRoute.put("/conversation/:conversationId/workspace/:workspaceId/close", verifyAccessToken, chatAccess.checkValidConversationGroup, chatAccess.roleAdmin, workspaceController.close)

module.exports = workspaceRoute;
