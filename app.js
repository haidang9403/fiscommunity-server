/* eslint-disable no-unused-vars */
const express = require("express");
const cors = require("cors");
const createError = require('http-errors');
const cookieParser = require("cookie-parser");

// Import route
const mainRouter = require("./app/routes/");
const { errorValidate, errorValidateAll } = require("./app/utils/validation.util");

const app = express();

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/api/fiscommunity", mainRouter);
// Routes
app.post("/test", (req, res, next) => {
    // if (!req.headers['authorization']) return next(createError(401, "Unauthorized"));
    // const token = req.headers['authorization']?.split(" ")[1]

    res.send({
        token: "123",
        chatInput: req.body.chatInput
    })
});

// Handle not found 404
app.use((req, res, next) => {
    return next(createError(404, "Resoure not found"));
})

// Define error-handling middleware last
app.use((err, req, res, next) => {
    if (err.name == "ValidationError") {
        if (err.one) return errorValidate(res, err);
        else if (err.all) return errorValidateAll(res, err);
    } else {
        return res.status(err.statusCode || 500).json({
            message: err.message || "Internal Server Error",
        })
    }
})

module.exports = app;