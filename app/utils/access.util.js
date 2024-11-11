const createError = require("http-errors");
const Post = require("../models/post.model");
const { TypePrivacy, GroupPermission } = require("@prisma/client");
const UserRelation = require("../models/users/user.relation.model");
const Comment = require("../models/comment.model");
const UserAttendGroup = require("../models/groups/user.attend.group.model");
const Group = require("../models/groups/group.model");
const prisma = require("../services/prisma");

const accessPost = async (req, res, next) => {
    try {
        const { postId } = req.params;
        const userId = req.payload.aud;

        const post = await Post.model.findUnique({
            where: {
                id: parseInt(postId)
            }
        })

        if (!post) return next(createError(404, "Post not found"))

        const isBlocked = await UserRelation.isBlocked(userId, post.ownerId);
        if (isBlocked) {
            return next(createError(403, "Not permission to access post"))
        }

        const isFriend = await UserRelation.isAddedFriend(userId, post.ownerId);

        let userPermission;
        if (post.groupId) {
            userPermission = await prisma.userAttendGroup.findFirst({
                where: {
                    groupId: post.groupId,
                    userId: parseInt(userId)
                }
            })

            if (!req.params.groupId) return next(createError(400))
        }

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
                else return next()
            case TypePrivacy.PRIVATE_GROUP:
                if (userPermission?.permission != GroupPermission.NONE) return next()
                break;
        }

        return next(createError(403, "Not permission to access this post"))
    } catch (e) {
        console.log(e);
        return next(createError(500, "Error when access post"))
    }
}

const accessOwnPost = async (req, res, next) => {
    try {
        const { postId } = req.params;
        const userId = req.payload.aud;

        // const groupId = req.params.groupId ? parseInt(req.params.groupId) : null;

        const post = await Post.model.findUnique({
            where: {
                id: parseInt(postId),
                // groupId: groupId
            }
        })

        if (!post) return next(createError(404, "Post not found"))

        // if (userId !== post.ownerId) return next(createError(403, "Not permission to access post"))

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

const accessGroup = ({
    owner = false,
    permission = [GroupPermission.NONE]
}) => {
    return async (req, res, next) => {
        try {
            const groupId = parseInt(req.params.groupId);
            const userId = parseInt(req.payload.aud);

            const isExistGroup = await Group.model.findUnique({
                where: {
                    id: parseInt(groupId)
                }
            })

            if (!isExistGroup) {
                return next(createError(404, "Group not exist"));
            }

            // Kiểm tra quyền sở hữu nhóm
            if (owner) {
                const isOwner = await Group.isOwner({ groupId, userId });
                if (isOwner) {
                    return next();
                } else {
                    return next(createError(403, "Only the owner can access this group"));
                }
            }

            // Lấy quyền của người dùng trong nhóm
            const userPermission = await prisma.userAttendGroup.findFirst({
                where: {
                    groupId,
                    userId
                }
            });

            // Nếu không có quyền, trả về lỗi
            if (!userPermission) {
                return next(createError(403, "No permission to access this group"));
            }

            // Kiểm tra quyền truy cập
            const userRole = userPermission.permission;
            const permissionLevels = [
                GroupPermission.NONE,
                GroupPermission.READER,
                GroupPermission.MEMBER,
                GroupPermission.ADMIN
            ];


            if (permissionLevels.indexOf(userRole) >= permissionLevels.indexOf(permission)) {
                return next();
            } else {
                return next(createError(403, "Not permission to access group"));
            }

        } catch (e) {
            console.log(e);
            return next(createError(500, "Error when accessing group"));
        }
    }
};


module.exports = {
    accessPost,
    accessOwnPost,
    accessComment,
    accessGroup
}