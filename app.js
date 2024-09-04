/* eslint-disable no-unused-vars */
const express = require("express");
const cors = require("cors");
const createError = require('http-errors');
const cookieParser = require("cookie-parser");

// Import route
const mainRouter = require("./app/routes/");

const app = express();

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/api/fiscommunity", mainRouter);

// Handle not found 404
app.use((req, res, next) => {
    return next(createError(404, "Resoure not found"));
})

// Define error-handling middleware last
app.use((err, req, res, next) => {
    return res.status(err.statusCode || 500).json({
        message: err.message || "Internal Server Error",
    })
})

module.exports = app;