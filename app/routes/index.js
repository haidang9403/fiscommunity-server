const express = require("express");

const testRoute = require("./test.route");
const authRoute = require("./auth.route");

const mainRoute = express.Router();

mainRoute.use(
    testRoute,
    authRoute
);

module.exports = mainRoute;