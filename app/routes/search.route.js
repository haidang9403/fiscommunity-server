const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const searchController = require("../controllers/search.controller");

const searchRoute = express.Router();

searchRoute.get("/search/people", verifyAccessToken, searchController.searchPeople)
searchRoute.get("/search/groups", verifyAccessToken, searchController.searchGroups)
searchRoute.get("/search/posts", verifyAccessToken, searchController.searchPosts)

module.exports = searchRoute;