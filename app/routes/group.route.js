const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const groupController = require("../controllers/group.controller");
const { uploadMediaToCloudinary, uploadImageToCloudinary } = require("../utils/cloudinary/upload.util");
const groupRoute = express.Router();

//-------- API Group --------- //

//--- Create group
groupRoute.post("/group", verifyAccessToken, groupController.createGroup)

//--- Update group
groupRoute.put("/group/:groupId", verifyAccessToken, groupController.updateGroup)

//--- Update avatar group
groupRoute.put("/group/:groupId/avatar", verifyAccessToken, uploadImageToCloudinary.single("avatar"), groupController.updateAvatarGroup)

//--- Request to attend group
groupRoute.post("/group/:groupId/attend", verifyAccessToken, groupController.requestAttend)


module.exports = groupRoute;