const express = require('express');
const { verifyAccessToken, verifyAccessTokenAndOwn } = require("../utils/jwt.util");
const { uploadMiddleware } = require('../utils/googleCloundStorage/upload.util');
const { uploadFile, uploadFolder, deleteFile, deleteFolder, getStructureDocument, getFile, getFolder, getInfoFolder, getFolerUser, getStructure, getStructureDocumentOfUser, updateFile, updateFolder } = require('../controllers/document.controller');

const documentRoute = express.Router();

//--------- API Create Document --------//
documentRoute.post("/document/file", verifyAccessToken, uploadMiddleware.single('file'), uploadFile);
documentRoute.post("/document/folder", verifyAccessToken, uploadMiddleware.array('files'), uploadFolder);

//--------- API Delete Document --------//
documentRoute.delete("/document/file/:fileId", verifyAccessToken, deleteFile)
documentRoute.delete("/document/folder/:folderId", verifyAccessToken, deleteFolder)

//--------- API Update Document --------//

documentRoute.put("/document/file/:fileId", verifyAccessToken, updateFile);
documentRoute.put("/document/folder/:folderId", verifyAccessToken, updateFolder);

//--------- API Get document -----------//
documentRoute.get("/document", verifyAccessToken, getStructureDocument)
documentRoute.get("/document/structure", verifyAccessToken, getStructure)
documentRoute.get("/document/folder", verifyAccessToken, getFolerUser)
documentRoute.get("/document/group/:groupId", verifyAccessToken, getStructureDocument)
documentRoute.get("/document/user/:userId", verifyAccessToken, getStructureDocumentOfUser)

documentRoute.get("/document/info/folder/:folderId", verifyAccessToken, getInfoFolder)

documentRoute.get("/document/file/:fileId", verifyAccessToken, getFile)

documentRoute.get("/document/folder/:folderId", verifyAccessToken, getFolder)

module.exports = documentRoute;