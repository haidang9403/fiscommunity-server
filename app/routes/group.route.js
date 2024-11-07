const express = require("express");
const { verifyAccessToken } = require("../utils/jwt.util");
const groupController = require("../controllers/group.controller");
const { uploadImageToCloudinary, uploadMediaToCloudinary } = require("../utils/cloudinary/upload.util");
const { accessGroup, accessOwnPost, accessPost, accessComment } = require("../utils/access.util");
const { GroupPermission } = require("@prisma/client");
const postController = require("../controllers/post.controller");
const { uploadMiddleware } = require("../utils/googleCloundStorage/upload.util");
const documentController = require("../controllers/document.controller");
const groupAccess = require("../security/group.access.right");
const groupRoute = express.Router();

//-------- API Group --------- //
//--- Get group recommend
groupRoute.get("/group/discover/all", verifyAccessToken, groupController.getDiscover)
groupRoute.get("/group/attended/all", verifyAccessToken, groupController.getGroupUser)
groupRoute.get("/group/:groupId", verifyAccessToken, groupController.getOneGroup)


//--- Create group
groupRoute.post("/group", verifyAccessToken, groupController.createGroup)

//--- Change permission
groupRoute.put("/group/:groupId/permission/user/:userId", verifyAccessToken, groupController.changePermission)

//--- Update group
groupRoute.put("/group/:groupId", verifyAccessToken, accessGroup({ permission: GroupPermission.ADMIN }), groupController.updateGroup)

//--- Update avatar group
groupRoute.put("/group/:groupId/avatar", verifyAccessToken, accessGroup({ permission: GroupPermission.ADMIN }), uploadImageToCloudinary.single("avatar"), groupController.updateAvatarGroup)

//--- Request to attend group -- socket
groupRoute.post("/group/:groupId/attend", verifyAccessToken, groupController.requestAttend)

groupRoute.delete("/group/:groupId/attend", verifyAccessToken, groupController.canceltAttend)

//--- Response to attend group -- socket (only accept)
groupRoute.post("/group/:groupId/response/user/:userId", verifyAccessToken, accessGroup({ permission: GroupPermission.ADMIN }), groupController.responseAttend)

//--- Delete group
groupRoute.delete("/group/:groupId", verifyAccessToken, accessGroup({ owner: true }), groupController.deleteGroup)

//--- Get request
groupRoute.get("/group/:groupId/request", verifyAccessToken, accessGroup({ permission: GroupPermission.ADMIN }), groupController.getRequest)

//-------- API Group Post --------- //

//--- Accept post -- socket
groupRoute.put("/group/:groupId/post/:postId/accept", verifyAccessToken, accessGroup({ permission: GroupPermission.ADMIN }), groupAccess.postExist, groupController.acceptPost)

//--- Refuse post
groupRoute.delete("/group/:groupId/post/:postId/refuse", verifyAccessToken, accessGroup({ permission: GroupPermission.ADMIN }), groupAccess.postExist, groupController.refusePost)

//--- Create post
groupRoute.post("/group/:groupId/post", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), uploadMediaToCloudinary.array("media", 10), groupAccess.document, postController.createPost)

//--- Get post
groupRoute.get("/group/:groupId/post", verifyAccessToken, accessGroup({ permission: GroupPermission.READER }), postController.getPostGroup)

//--- Get post pending
groupRoute.get("/group/:groupId/pending/post", verifyAccessToken, accessGroup({ permission: GroupPermission.ADMIN }), postController.getPendingPostGroup)

//--- Get post pending
groupRoute.get("/group/:groupId/pending/post/user", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), postController.getPendingPostUser)

//--- Get post group feed
groupRoute.get("/feed/group", verifyAccessToken, postController.getFeedGroup)


//--- Delete post
groupRoute.delete("/group/:groupId/post/:postId", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), groupAccess.post, postController.deletePost)

//--- Update post
groupRoute.put("/group/:groupId/post/:postId", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), uploadMediaToCloudinary.array("media", 10), groupAccess.post, accessOwnPost, postController.updatePost)

//--- Like post -- socket
groupRoute.post("/group/:groupId/post/:postId/like", verifyAccessToken, accessGroup({ permission: GroupPermission.READER }), groupAccess.postExist, accessPost, postController.likePost)

//--- Share post -- socket
groupRoute.post("/group/:groupId/post/:postId/share", verifyAccessToken, accessGroup({ permission: GroupPermission.READER }), groupAccess.postExist, accessPost, postController.sharePost)

//--- Share post via message -- socket
//groupRoute.post("/group/:groupId/post/:postId/share/message", verifyAccessToken, accessGroup({ permission: GroupPermission.READER }), groupAccess.postExist, accessPost, postController.sharePost)

//--- Comment post -- socket
groupRoute.post("/group/:groupId/post/:postId/comment", verifyAccessToken, accessGroup({ permission: GroupPermission.READER }), groupAccess.postExist, accessPost, postController.commentPost)

//--- Reply comment -- socket
groupRoute.post("/group/:groupId/post/:postId/comment/:commentId/reply", verifyAccessToken, accessGroup({ permission: GroupPermission.READER }), groupAccess.postExist, accessPost, accessComment, postController.replyComment)

//--- Get replycomment
groupRoute.get("/group/:groupId/post/:postId/comment/:commentId/reply", verifyAccessToken, accessGroup({ permission: GroupPermission.NONE }), accessPost, accessComment, postController.getReply)

//--- Like comment -- socket
groupRoute.post("/group/:groupId/post/:postId/comment/:commentId/like", verifyAccessToken, accessGroup({ permission: GroupPermission.READER }), groupAccess.postExist, accessPost, accessComment, postController.likeComment)

//--------- API Create Document --------//
groupRoute.post("/group/:groupId/document/file", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), uploadMiddleware.single('file'), documentController.uploadFile);
groupRoute.post("/group/:groupId/document/folder", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), uploadMiddleware.array('files'), documentController.uploadFolder);

//--------- API Delete Document --------//
groupRoute.delete("/group/:groupId/document/file/:fileId", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), documentController.deleteFile)
groupRoute.delete("/group/:groupId/document/folder/:folderId", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), documentController.deleteFolder)

//--------- API Update Document --------//
groupRoute.put("/group/:groupId/document/:userId/:documentId", accessGroup({ permission: GroupPermission.MEMBER }), (req, res) => {
    res.send("Update document")
});

//--------- API Get document -----------//
groupRoute.get("/group/:groupId/document/folder", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), documentController.getFolerGroup)
groupRoute.get("/group/:groupId/document", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), documentController.getStructureDocument)
groupRoute.get("/group/:groupId/document/structure", verifyAccessToken, accessGroup({ permission: GroupPermission.NONE }), documentController.getStructure)


groupRoute.get("/group/:groupId/document/file/:fileId", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), documentController.getFile)

groupRoute.get("/group/:groupId/document/folder/:folderId", verifyAccessToken, accessGroup({ permission: GroupPermission.MEMBER }), documentController.getFolder)

module.exports = groupRoute;