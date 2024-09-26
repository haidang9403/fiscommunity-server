const express = require("express");
const { uploadMediaToCloudinary } = require("../utils/cloudinary/upload.util");
const postController = require("../controllers/post.controller");
const { verifyAccessToken } = require("../utils/jwt.util");
const { accessPost, accessOwnPost, accessComment } = require("../utils/access.util");

const postRoute = express.Router();

//--------- API Post---------//

//--- Create post
postRoute.post("/post", verifyAccessToken, uploadMediaToCloudinary.array("media", 10), postController.createPost)

//--- Delete post
postRoute.delete("/post/:postId", verifyAccessToken, accessOwnPost, postController.deletePost)

//--- Update post
postRoute.put("/post/:postId", verifyAccessToken, accessOwnPost, postController.updatePost)

//--- Like post
postRoute.post("/post/:postId/like", verifyAccessToken, accessPost, postController.likePost)

//--- Share post
postRoute.post("/post/:postId/share", verifyAccessToken, accessPost, postController.sharePost)

//--- Share post via message
postRoute.post("/post/:postId/share/message", verifyAccessToken, accessPost, postController.sharePost)

//--- Comment post
postRoute.post("/post/:postId/comment", verifyAccessToken, accessPost, postController.commentPost)

//--- Reply comment
postRoute.post("/post/:postId/comment/:commentId/reply", verifyAccessToken, accessPost, accessComment, postController.replyComment)

//--- Like comment
postRoute.post("/post/:postId/comment/:commentId/like", verifyAccessToken, accessPost, accessComment, postController.likeComment)

module.exports = postRoute;