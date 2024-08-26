const express = require("express");

const testRouth = express.Router();

testRouth.get("/test", (req, res) => {
    res.send("<h1>Test route</h1>");
})

module.exports = testRouth;