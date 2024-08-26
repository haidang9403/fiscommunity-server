const express = require("express");

const testRoute = express.Router();

testRoute.get("/test", async (req, res, next) => {
    try {
        const allUsers = await global.prisma.user.findMany()
        console.dir(allUsers, { depth: null })
        res.send("Test successfull!");
    } catch (err) {
        console.error(err);
        next(err);
    }
})

module.exports = testRoute;