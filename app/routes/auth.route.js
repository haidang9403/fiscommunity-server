const express = require("express");
const authController = require("../controllers/auth.controller");
const { verifyRefreshToken } = require("../utils/jwt.util");

const authRoute = express.Router();

// ------------ API Login --------------- //
authRoute.post("/login", authController.login);

// ------------ API Register ---------------- //
authRoute.post("/register", authController.register);

// ------------ API Logout --------------- //
authRoute.post("/logout", verifyRefreshToken, authController.logout);

// ----------- API Refresh Token ---------- //
authRoute.post("/refresh", verifyRefreshToken, authController.refreshToken)

module.exports = authRoute;