const express = require("express");

const testRoute = express.Router();

testRoute.get("/test", async (req, res, next) => {
    try {
        res.send("Test successfull");
    } catch (err) {
        console.error(err);
        next(err);
    }
})

module.exports = testRoute;