const express = require("express");

const testRoute = require("./test.route");
const authRoute = require("./auth.route");
const userRoute = require("./user.route");
const documentRoute = require("./document.route");
const postRoute = require("./post.route");

const mainRoute = express.Router();

mainRoute.use(
    testRoute,
    authRoute,
    documentRoute,
    userRoute,
    postRoute
);

module.exports = mainRoute;