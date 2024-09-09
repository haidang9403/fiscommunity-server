const express = require("express");
const userController = require("../controllers/user.controller");
const { verifyAccessTokenAndOwn } = require("../utils/jwt.util");

const userRoute = express.Router();

//-------- API Get User --------- //
// Get one user
userRoute.get("/user/:userId", verifyAccessTokenAndOwn, userController.getUser);

// Get all user
// userRoute.get("/user", userController.getAllUser);

//-------- API User Profile -------- //
// Update Profile
userRoute.put("/user/profile/:userId", verifyAccessTokenAndOwn, userController.updateProfile);

// Change password
userRoute.put("/user/password/:userId", verifyAccessTokenAndOwn, userController.changePassword);

module.exports = userRoute;