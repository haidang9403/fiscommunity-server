const createError = require("http-errors");
const Post = require("../models/post.model");
const Media = require("../models/media.model");
const prisma = require("../services/prisma");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary/delete.util");
const { TypePost } = require("@prisma/client");
const Comment = require("../models/comment.model");

const postController = {
    //------- CREATE POST --------//
    createPost: async (req, res, next) => {
        try {
            const { content, captions = [], files, folders } = req.body;
            const ownerId = parseInt(req.payload.aud);

            // Tạo bài đăng
            const post = new Post({
                content,
                ownerId,
                files,
                folders
            });

            const postSaved = await post.save();

            const medias = req.files
            for (const [index, media] of medias.entries()) {
                const newMedia = new Media({
                    url: media.path,
                    postId: postSaved.id,
                    type: Media.getTypeMedia(media),
                    caption: captions[index]
                })

                await newMedia.save();
            }

            const postCreate = await prisma.post.findUnique({
                where: {
                    id: postSaved.id
                },
                include: {
                    media: true,
                }
            })

            res.status(200).json(postCreate)
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when create post"))
        }
    },
    //------- UPDATE POST --------//
    updatePost: async (req, res, next) => {
        try {
            const { content, privacy, captions = {} } = req.body;
            const { postId } = req.params;
            const userId = req.payload.aud;

            const ids = Object.keys(captions)
            for (const id of ids) {
                const media = new Media({
                    id: parseInt(id),
                    caption: captions[id]
                })

                await media.save();
            }

            const post = new Post({
                id: parseInt(postId),
                content: content,
                ownerId: parseInt(userId),
                privacy,
            })

            const postUpdated = await post.save();

            res.status(200).json(postUpdated);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when update post"))
        }
    },
    //------- DELETE POST --------//
    deletePost: async (req, res, next) => {
        try {
            const { postId } = req.params;

            const medias = await Media.model.findMany({
                where: {
                    postId: parseInt(postId)
                }
            })

            let result;
            for (const media of medias) {
                result = await deleteMediaFromCloudinary(media);
            }

            if (result !== 'ok') {
                return next(createError(500, "Error when delete media"))
            }

            const postDeleted = await Post.delete(postId);

            res.send(postDeleted);
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when delete post"))
        }
    },
    //------- LIKE POST --------//
    likePost: async (req, res, next) => {
        try {
            const postId = req.params.postId;
            const userId = req.payload.aud;

            const postLiked = await Post.like({
                postId,
                userId
            })

            res.send(postLiked)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when like post"))
        }
    },
    //------- SHARE POST --------//
    sharePost: async (req, res, next) => {
        try {
            const { postId } = req.params;
            const { content, privacy } = req.body;
            const userId = req.payload.aud;

            const postShare = new Post({
                content: content,
                ownerId: parseInt(userId),
                privacy,
                type: TypePost.SHARE,
                postShareId: parseInt(postId),
            })

            const postShareSaved = await postShare.save();

            await Post.share({ postId, userId });

            res.status(200).json(postShareSaved)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when share post"))
        }
    },
    //------- SHARE POST VIA MESSAGE --------//
    sharePostViaMessage: async (req, res, next) => {
        try {
            res.send("Share post via message")
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when share post via message"))
        }
    },
    //------- COMMENT POST --------//
    commentPost: async (req, res, next) => {
        try {
            const { postId } = req.params;
            const userId = req.payload.aud;
            const { content, url } = req.body;

            const comment = new Comment({
                content,
                url,
                postId,
                userId
            })

            const commentSaved = await comment.save();

            await Post.comment({ postId });

            res.send(commentSaved)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when comment post"))
        }
    }
}

module.exports = postController;