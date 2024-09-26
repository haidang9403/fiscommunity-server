const express = require("express");
const userController = require("../controllers/user.controller");
const { verifyAccessTokenAndOwn, verifyAccessToken } = require("../utils/jwt.util");

const userRoute = express.Router();

//-------- API Get User --------- //

//--- Get one user
userRoute.get("/user/:userId", verifyAccessTokenAndOwn, userController.getUser);

//--- Get all user
// userRoute.get("/user", userController.getAllUser);

//-------- API User Profile -------- //

//--- Update Profile
userRoute.put("/user/profile/:userId", verifyAccessTokenAndOwn, userController.updateProfile);

//--- Change password
userRoute.put("/user/password/:userId", verifyAccessTokenAndOwn, userController.changePassword);

//-------- API User Relation ----------//

//--- Adding friend
userRoute.post("/user/addfriend/:reciveId", verifyAccessToken, userController.addFriend);

//--- Accept adding friend
userRoute.post("/user/acceptfriend/:senderId", verifyAccessToken, userController.acceptFriend)

//--- Deny adding friend
userRoute.post("/user/denyfriend/:senderId", verifyAccessToken, userController.denyUser)

//--- Unfriend
userRoute.post("/user/unfriend/:reciveId", verifyAccessToken, userController.unfriend)

//--- Remove Addfriend
userRoute.post("/user/removeinvite/:reciveId", verifyAccessToken, userController.removeInvite)

//--- Follow
userRoute.post("/user/follow/:reciveId", verifyAccessToken, userController.followUser)

//--- Block
userRoute.post("/user/block/:reciveId", verifyAccessToken, userController.blockUser)

userRoute.get("/user/friend", verifyAccessToken, (req, res) => {
    res.send("Get all friend")
})

userRoute.get("/user/block", verifyAccessToken, (req, res) => {
    res.send("Get all blocked user")
})

userRoute.get("/user/follow", verifyAccessToken, (req, res) => {
    res.send("Get all follower")
})

module.exports = userRoute;