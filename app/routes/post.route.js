const express = require("express");
const { uploadMediaToCloudinary } = require("../utils/cloudinary/upload.util");
const postController = require("../controllers/post.controller");
const { verifyAccessToken } = require("../utils/jwt.util");
const { accessPost, accessOwnPost, accessComment } = require("../utils/access.util");
const userAccess = require("../security/user.access.right");

const postRoute = express.Router();

//--------- API Post---------//

//--- Get all post
// postRoute.get("/post/user/:userId/post/all", verifyAccessToken,)

postRoute.get("/post/:postId", verifyAccessToken, postController.getOnePostUser)

//--- Get post
postRoute.get("/post/user/:userId/post", verifyAccessToken, postController.getPost)

//--- Get post feed home
postRoute.get("/feed/user", verifyAccessToken, postController.getFeedUser)

//--- Create post
postRoute.post("/post", verifyAccessToken, uploadMediaToCloudinary.array("media", 10), userAccess.document, postController.createPost)

postRoute.post("/pos", uploadMediaToCloudinary.array("media", 10), postController.createPost)

//--- Delete post
postRoute.delete("/post/:postId", verifyAccessToken, accessOwnPost, postController.deletePost)

//--- Update post 
postRoute.put("/post/:postId", verifyAccessToken, accessOwnPost, uploadMediaToCloudinary.array("media", 10), userAccess.document, postController.updatePost)

//--- Like post -- socket
postRoute.post("/post/:postId/like", verifyAccessToken, accessPost, postController.likePost)

//--- Share post -- socket
postRoute.post("/post/:postId/share", verifyAccessToken, accessPost, postController.sharePost)

//--- Share post via message -- socket
postRoute.post("/post/:postId/conversation/:conversationId/share/message", verifyAccessToken, accessPost, postController.sharePostViaMessage)

//--- Comment post -- socket
postRoute.post("/post/:postId/comment", verifyAccessToken, accessPost, postController.commentPost)

//--- Get replycomment
postRoute.get("/post/:postId/comment/:commentId/reply", verifyAccessToken, accessPost, accessComment, postController.getReply)

//--- Reply comment -- socket
postRoute.post("/post/:postId/comment/:commentId/reply", verifyAccessToken, accessPost, accessComment, postController.replyComment)

//--- Like comment -- socket
postRoute.post("/post/:postId/comment/:commentId/like", verifyAccessToken, accessPost, accessComment, postController.likeComment)

module.exports = postRoute;