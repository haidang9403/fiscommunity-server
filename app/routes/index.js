const express = require("express");

const testRoute = require("./test.route");

testRoute.use(
    express,

);

module.exports = testRoute;