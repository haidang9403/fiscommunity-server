const express = require("express");
const prisma = require("../services/prisma")

const testRoute = express.Router();

testRoute.get("/test", async (req, res, next) => {
    try {
        const allUsers = await prisma.user.findMany()
        console.dir(allUsers, { depth: null });
        res.send(allUsers);
    } catch (err) {
        console.error(err);
        next(err);
    }
})

module.exports = testRoute;