const express = require("express");
const userController = require("../controllers/user.controller");
const { verifyAccessTokenAndOwn, verifyAccessToken } = require("../utils/jwt.util");
const { uploadImageToCloudinary } = require("../utils/cloudinary/upload.util");

const userRoute = express.Router();

//-------- API Get User --------- //

//--- Get one user
userRoute.get("/user/one/:userId", verifyAccessToken, userController.getUser);

//--- Get all user
// userRoute.get("/user", userController.getAllUser);

//-------- API User Profile -------- //

//--- Update Profile
userRoute.put("/user/profile", verifyAccessToken, uploadImageToCloudinary.single('avatar'), userController.updateProfile);

//--- Change password
userRoute.put("/user/password/:userId", verifyAccessTokenAndOwn, userController.changePassword);

//-------- API User Relation ----------//

//--- Adding friend fa -- socket
userRoute.post("/user/addfriend/:reciveId", verifyAccessToken, userController.addFriend);

//--- Accept adding friend -- socket
userRoute.post("/user/acceptfriend/:senderId", verifyAccessToken, userController.acceptFriend)

//--- Deny adding friend
userRoute.post("/user/denyfriend/:senderId", verifyAccessToken, userController.denyUser)

//--- Unfriend
userRoute.post("/user/unfriend/:reciveId", verifyAccessToken, userController.unfriend)

//--- Remove Addfriend
userRoute.post("/user/removeinvite/:reciveId", verifyAccessToken, userController.removeInvite)

//--- Follow -- socket
userRoute.post("/user/follow/:reciveId", verifyAccessToken, userController.followUser)

//--- Block
userRoute.post("/user/block/:reciveId", verifyAccessToken, userController.blockUser)

userRoute.get("/user/recommend", verifyAccessToken, userController.getRecommend)
userRoute.get("/user/waiting", verifyAccessToken, userController.getWaitingUser)

userRoute.get("/user/friend", verifyAccessToken, userController.getFriends)
userRoute.get("/user/block", verifyAccessToken, userController.getBlockingUser)
userRoute.get("/user/friend/:userId", verifyAccessToken, userController.getFriends)
userRoute.get("/user/following/:userId", verifyAccessToken, userController.getFollowingUser)
userRoute.get("/user/follower/:userId", verifyAccessToken, userController.getFollowerUser)

userRoute.get("/user/follow", verifyAccessToken, (req, res) => {
    res.send("Get all follower")
})

module.exports = userRoute;