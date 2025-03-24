const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const { uploadMiddleware } = require("../utils/googleCloundStorage/upload.util");
const aiController = require("../controllers/ai.controller");
const { uploadMediaToCloudinary } = require("../utils/cloudinary/upload.util");

const aiRoute = express.Router();

// ------ API chat ------- //
aiRoute.post("/ai/chat", verifyAccessToken, uploadMiddleware.array("files"), aiController.checkAi, aiController.chatToAi)

// ------ API get all conversation ------- //
aiRoute.get("/ai/conversation", verifyAccessToken, aiController.checkValidAi, aiController.getListConversation)

// ------ API get message on conversation
aiRoute.get("/ai/conversation/:conversationId/message", verifyAccessToken, aiController.checkValidAi, aiController.checkValidConversation, aiController.getListMessage)

// -------- API for Ai ------ //
aiRoute.post("/ai/response", aiController.responseToUser)

aiRoute.post("/ai/save/image", uploadMediaToCloudinary.single("image"), aiController.saveFile)

aiRoute.post("/ai/change/title", aiController.updateTitleAi)

module.exports = aiRoute;
