const express = require("express");
const { uploadMediaToCloudinary } = require("../utils/cloudinary/upload.util");
const postController = require("../controllers/post.controller");
const { verifyAccessToken } = require("../utils/jwt.util");

const postRoute = express.Router();

//--------- API Post---------//

//--- Create post
postRoute.post("/post", verifyAccessToken, uploadMediaToCloudinary.array("media", 10), postController.createPost)

//--- Delete post
postRoute.delete("/post/:postId", verifyAccessToken, postController.deletePost)

//--- Update post
postRoute.put("/post/:postId", verifyAccessToken, postController.updatePost)

//--- Like post
postRoute.post("/post/:postId/like", verifyAccessToken, postController.likePost)

//--- Share post
postRoute.post("/post/:postId/share", verifyAccessToken, postController.sharePost)

//--- Share post via message
postRoute.post("/post/:postId/share/message", verifyAccessToken, postController.sharePost)

//--- Comment post
postRoute.post("/post/:postId/comment", verifyAccessToken, postController.commentPost)
module.exports = postRoute;