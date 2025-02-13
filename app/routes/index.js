const express = require("express");

const testRoute = require("./test.route");
const authRoute = require("./auth.route");
const userRoute = require("./user.route");
const documentRoute = require("./document.route");
const postRoute = require("./post.route");
const groupRoute = require("./group.route");
const chatRoute = require("./chat.route");
const searchRoute = require("./search.route");
const callRoute = require("./call.route")

const mainRoute = express.Router();

mainRoute.use(
    testRoute,
    authRoute,
    documentRoute,
    userRoute,
    postRoute,
    groupRoute,
    chatRoute,
    searchRoute,
    callRoute
);

module.exports = mainRoute;