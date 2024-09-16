const express = require('express');
const { verifyAccessToken } = require("../utils/jwt.util");
const { uploadMiddleware } = require('../utils/googleCloundStorage/upload.util');
const { uploadFile, uploadFolder, deleteFile, deleteFolder } = require('../controllers/document.controller');

const documentRoute = express.Router();

//--------- API Create Document --------//
documentRoute.post("/document/file", verifyAccessToken, uploadMiddleware.single('file'), uploadFile);
documentRoute.post("/document/folder", verifyAccessToken, uploadMiddleware.array('files'), uploadFolder);

//--------- API Delete Document --------//
documentRoute.delete("/document/file/:fileId", verifyAccessToken, deleteFile)
documentRoute.delete("/document/folder/:folderId", verifyAccessToken, deleteFolder)

//--------- API Update Document --------//
documentRoute.put("/document/:userId/:documentId", (req, res) => {
    res.send("Update document")
});

module.exports = documentRoute;