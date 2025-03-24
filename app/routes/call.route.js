const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const callController = require("../controllers/call.controller");

const callRoute = express.Router();

// ------ API Join room ------- //
callRoute.post("/call/join-room", verifyAccessToken, callController.joinRoom);

// ------ API Get list active room --------- //
callRoute.get("/call/list-active-room", verifyAccessToken, callController.getRoom);

callRoute.post("/call/disconnect-room", verifyAccessToken, callController.disconnectRoom);

module.exports = callRoute;
