const express = require("express");

const testRoute = require("./test.route");
const authRoute = require("./auth.route");
const userRoute = require("./user.route");

const mainRoute = express.Router();

mainRoute.use(
    testRoute,
    authRoute,
    userRoute
);

module.exports = mainRoute;