const createError = require("http-errors");
const Post = require("../models/post.model");
const { TypePrivacy } = require("@prisma/client");
const UserRelation = require("../models/users/user.relation.model");
const Comment = require("../models/comment.model");

const accessPost = async (req, res, next) => {
    try {
        const { postId } = req.params;
        const userId = req.payload.aud;

        const post = await Post.model.findUnique({
            where: {
                id: parseInt(postId)
            }
        })

        const isBlocked = await UserRelation.isBlocked(userId, post.ownerId);
        if (isBlocked) {
            return next(createError(403, "Not permission to access post"))
        }

        const isFriend = await UserRelation.isAddedFriend(userId, post.ownerId);
        switch (post.privacy) {
            case TypePrivacy.PUBLIC:
                return next()
            case TypePrivacy.FRIENDS:
                if (isFriend) {
                    return next()
                } else {
                    return next(createError(403, "Not permission to access post"))
                }
            case TypePrivacy.PRIVATE:
                if (post.ownerId != userId)
                    return next(createError(403, "Not permission to access post"))
                else next()
        }
    } catch (e) {
        console.log(e);
        next(createError(500, "Error when access post"))
    }
}

const accessOwnPost = async (req, res, next) => {
    try {
        const { postId } = req.params;
        const userId = req.payload.aud;

        const post = await Post.model.findUnique({
            where: {
                id: parseInt(postId)
            }
        })

        if (userId !== post.ownerId) return next(createError(403, "Not permission to access post"))

        return next();
    } catch (e) {
        console.log(e);
        next(createError(500, "Error when access post"))
    }
}

const accessComment = async (req, res, next) => {
    try {
        const { commentId } = req.params;
        const userId = req.payload.aud;

        const comment = await Comment.model.findUnique({
            where: {
                id: parseInt(commentId)
            }
        })

        const isBlocked = await UserRelation.isBlocked(userId, comment.userId);
        if (isBlocked) {
            return next(createError(403, "Not permission to access comment"))
        }

        return next();
    } catch (e) {
        console.log(e);
        next(createError(500, "Error when access comment"))
    }
}

const accessGroup = async (req, res, next) => {

}

module.exports = {
    accessPost,
    accessOwnPost,
    accessComment
}