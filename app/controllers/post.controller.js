const createError = require("http-errors");
const Post = require("../models/post.model");
const Media = require("../models/media.model");
const prisma = require("../services/prisma");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary/delete.util");
const { TypePost, UploadPostWhere, TypeGroup, TypePrivacy } = require("@prisma/client");
const Comment = require("../models/comment.model");
const Group = require("../models/groups/group.model");

const postController = {
    //------- CREATE POST --------//
    createPost: async (req, res, next) => {
        try {
            const { content, files, folders } = req.body;
            let privacy = req.body.privacy;
            const ownerId = parseInt(req.payload.aud);
            const groupId = req.params.groupId;
            let captions = req.body.captions ?? []

            if (typeof (captions) == 'string') captions = [captions]

            const from = groupId ? UploadPostWhere.GROUP : UploadPostWhere.USER;

            let group = null;
            if (groupId) {
                group = await Group.model.findUnique({
                    where: {
                        id: parseInt(groupId)
                    }
                })
            }

            let isApproved = true;
            if (group) {
                if (group.approvalRequired) {
                    isApproved = false;
                }

                if (group.type == TypeGroup.PUBLIC) {
                    privacy = TypePrivacy.PUBLIC
                } else if (group.type == TypeGroup.PRIVATE) {
                    privacy = TypePrivacy.PRIVATE_GROUP
                }
            }

            // Tạo bài đăng
            const post = new Post({
                content,
                ownerId,
                files,
                folders,
                privacy,
                from,
                groupId,
                isApproved
            });

            const postSaved = await post.save();

            const medias = req.files

            for (const [index, media] of medias.entries()) {
                const caption = captions[index];
                const newMedia = new Media({
                    url: media.path,
                    postId: postSaved.id,
                    type: Media.getTypeMedia(media),
                    caption
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

            return res.status(200).json(postCreate)
        } catch (e) {
            console.log(e);
            const medias = req.files;
            for (const media of medias) {
                const result = await deleteMediaFromCloudinary(media);
                if (result != 'ok') return next(createError(500, "Error when create post"))
            }
            return next(createError(500, "Error when create post"))
        }
    },
    //------- UPDATE POST --------//
    updatePost: async (req, res, next) => {
        try {
            const { content = null, files = [], folders = [] } = req.body;
            const { postId } = req.params;
            const userId = req.payload.aud;
            let privacy = req.body.privacy;
            let captions = req.body.captions ?? []

            if (typeof (captions) == 'string') captions = [captions]

            const groupId = req.params.groupId;

            let group = null;
            if (groupId) {
                group = await Group.model.findUnique({
                    where: {
                        id: parseInt(groupId)
                    }
                })
            }

            if (group) {
                if (group.type == TypeGroup.PUBLIC) {
                    privacy = TypePrivacy.PUBLIC
                } else if (group.type == TypeGroup.PRIVATE) {
                    privacy = TypePrivacy.PRIVATE_GROUP
                }
            }

            const post = new Post({
                id: parseInt(postId),
                content,
                ownerId: parseInt(userId),
                privacy,
                files,
                folders
            })

            const postUpdated = await post.save();

            const mediaOlds = await Media.model.findMany({
                where: {
                    postId: parseInt(postId)
                }
            })

            let result;
            for (const media of mediaOlds) {
                result = await deleteMediaFromCloudinary(media);
            }

            if (result !== 'ok') {
                return next(createError(500, "Error when delete media"))
            }

            const deletedOldMedia = await Post.deleteAllMedia(postId);

            if (!deletedOldMedia) {
                return next(createError(500, "Error when delete media"))
            }

            const medias = req.files

            for (const [index, media] of medias.entries()) {
                const caption = captions[index];
                const newMedia = new Media({
                    url: media.path,
                    postId: postUpdated.id,
                    type: Media.getTypeMedia(media),
                    caption
                })

                await newMedia.save();
            }

            const postUpdatedSuccessfull = await prisma.post.findUnique({
                where: {
                    id: postUpdated.id
                },
                include: {
                    media: true,
                }
            })

            return res.status(200).json(postUpdatedSuccessfull);
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

            return res.send(postDeleted);
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when delete post"))
        }
    },
    //------- LIKE POST --------//
    likePost: async (req, res, next) => {
        try {
            const postId = req.params.postId;
            const userId = req.payload.aud;

            if (!postId) return next(createError(400, "Post not exist"))

            const post = await Post.model.findFirst({
                where: {
                    id: parseInt(postId),
                    isApproved: true
                }
            })

            if (!post) return next(createError(403, "Not access this post"))

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

            if (!postId) return next(createError(400, "Post not exist"))

            const post = await Post.model.findFirst({
                where: {
                    id: parseInt(postId),
                    isApproved: true
                }
            })

            if (!post) return next(createError(403, "Not access this post"))

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

            if (!postId) return next(createError(400, "Post not exist"))

            const post = await Post.model.findFirst({
                where: {
                    id: parseInt(postId),
                    isApproved: true
                }
            })

            if (!post) return next(createError(403, "Not access this post"))


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
    },
    //------- REPLY COMMENT --------//
    replyComment: async (req, res, next) => {
        try {
            const { postId, commentId } = req.params;
            const userId = req.payload.aud;
            const { content, url } = req.body;

            if (!postId) return next(createError(400, "Post not exist"))

            const post = await Post.model.findFirst({
                where: {
                    id: parseInt(postId),
                    isApproved: true
                }
            })

            if (!post) return next(createError(403, "Not access this post"))

            const comment = new Comment({
                content,
                url,
                postId,
                userId,
                replyId: parseInt(commentId)
            })

            const commentSaved = await comment.save();

            await Post.comment({ postId });

            res.send(commentSaved)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when reply comment"))
        }
    },
    //------- LIKE COMMENT --------//
    likeComment: async (req, res, next) => {
        try {
            const { commentId } = req.params
            const userId = req.payload.aud

            if (!commentId) return next(createError(400, "Post not exist"))

            const comment = await Comment.model.findUnique({
                where: {
                    id: parseInt(commentId),
                }
            })

            if (!comment) return next(createError(403, "Not access this comment"))


            const commentLiked = await Comment.like({
                commentId: parseInt(commentId),
                userId: parseInt(userId)
            })

            res.status(200).json(commentLiked)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when like comment"))
        }
    }
}

module.exports = postController;