const createError = require("http-errors");
const Group = require("../models/groups/group.model");
const { deleteImageFromCloudinary, deleteMediaFromCloudinary } = require("../utils/cloudinary/delete.util");
const { StateAttendGroup, GroupPermission } = require("@prisma/client");
const UserAttendGroup = require("../models/groups/user.attend.group.model");
const Post = require("../models/post.model");
const Media = require("../models/media.model");

const groupController = {
    //------------ CREATE GROUP ---------------//
    createGroup: async (req, res, next) => {
        try {
            const userId = req.payload.aud;
            const { groupName, bio, approvalRequired, type } = req.body;

            if (!groupName) {
                return res.status(400).json({ groupName: "Tên nhóm không thể trống" })
            }

            const group = new Group({
                groupName,
                bio,
                approvalRequired,
                type,
                ownerId: userId
            })

            const groupSaved = await group.save();

            // Allocate permission for owner
            const userAttendGroup = new UserAttendGroup({
                groupId: groupSaved.id,
                userId: groupSaved.ownerId,
                state: StateAttendGroup.ACCEPTED,
                permission: GroupPermission.ADMIN
            })

            await userAttendGroup.save();

            return res.status(200).json({
                ...groupSaved,
                totalStorage: groupSaved.totalStorage.toString(),
                limitStorage: groupSaved.limitStorage.toString()
            })
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when create group"))
        }
    },
    //------------ UPDATE GROUP ---------------//
    updateGroup: async (req, res, next) => {
        try {
            const groupId = req.params.groupId;
            const { groupName, bio, approvalRequired, type } = req.body;

            const group = new Group({
                id: groupId,
                groupName,
                bio,
                approvalRequired,
                type
            })

            const groupSaved = await group.save();

            return res.status(200).json({
                ...groupSaved,
                totalStorage: groupSaved.totalStorage.toString(),
                limitStorage: groupSaved.limitStorage.toString()
            })
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when update avatar group"))
        }
    },
    //------------ UPDATE AVATAR GROUP ---------------//
    updateAvatarGroup: async (req, res, next) => {
        try {
            const groupId = req.params.groupId;

            const avatar = req.file;
            if (!avatar) {
                return next(createError(500, "Error when upload image"))
            }

            const { avatar: oldAvatar } = await Group.model.findUnique({
                where: {
                    id: parseInt(groupId)
                },
                select: {
                    avatar: true
                }
            })

            if (oldAvatar) {
                const result = await deleteImageFromCloudinary(oldAvatar);
                if (result !== 'ok') {
                    await deleteImageFromCloudinary(avatar.path)
                    return next(createError(500, "Error when delete old avatar"))
                }
            }

            const group = new Group({
                id: groupId,
                avatar: avatar.path,
            })

            const groupSaved = await group.save();

            return res.status(200).json({
                ...groupSaved,
                totalStorage: groupSaved.totalStorage.toString(),
                limitStorage: groupSaved.limitStorage.toString()
            })
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when update group"))
        }
    },
    //------------ REQUEST ATTEND GROUP ---------------//
    requestAttend: async (req, res, next) => {
        try {
            const groupId = req.params.groupId;
            const userId = req.payload.aud;
            const state = StateAttendGroup.PENDING;

            const isPenddingAttend = await UserAttendGroup.isPendding({ groupId, userId })
            if (isPenddingAttend) {
                return next(createError(400, "Request is exist"))
            }

            const userAttendGroup = new UserAttendGroup({
                groupId,
                userId,
                state
            })

            const userAttendGroupSaved = await userAttendGroup.save();

            res.send(userAttendGroupSaved)

        } catch (e) {
            console.log(e)
            next(createError(500, "Error when request to attend group"))
        }
    },
    //------------ RESPONSE ATTEND GROUP ---------------//
    responseAttend: async (req, res, next) => {
        try {
            const { groupId, userId } = req.params;
            const { state } = req.body;

            if (!Object.values(StateAttendGroup).includes(state)) {
                return next(createError(400, "State not valid"))
            }

            let permission = GroupPermission.NONE;
            if (state == StateAttendGroup.ACCEPTED) {
                permission = GroupPermission.MEMBER
            }

            const userAttendGroup = new UserAttendGroup({
                userId,
                groupId,
                state,
                permission
            })

            const userAttendGroupSaved = await userAttendGroup.save();

            res.send(userAttendGroupSaved)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when response attending group"))
        }
    },
    //------------ RESPONSE ATTEND GROUP ---------------//
    deleteGroup: async (req, res, next) => {
        try {
            const { groupId } = req.params;

            const deleteGroup = await Group.model.delete({
                where: {
                    id: parseInt(groupId)
                }
            })

            res.status(200).json({
                ...deleteGroup,
                limitStorage: deleteGroup.limitStorage.toString(),
                totalStorage: deleteGroup.totalStorage.toString()
            })
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when deleting group"))
        }
    },
    //------------ ACCEPT POST ---------------//
    acceptPost: async (req, res, next) => {
        try {
            const { groupId, postId } = req.params;
            const isApproved = true;

            if (!groupId || !postId) return next(createError(400))

            const post = await Post.model.update({
                where: {
                    id: parseInt(postId),
                    groupId: parseInt(groupId),
                    isApproved: false
                },
                data: {
                    isApproved
                }
            })

            if (!post) return next(createError(400))

            res.status(200).json(post)
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when accept post"))
        }
    },
    //------------ REFUSE POST ---------------//
    refusePost: async (req, res, next) => {
        try {
            const { groupId, postId } = req.params;

            if (!groupId || !postId) return next(createError(400))

            const postToDelete = await Post.model.findFirst({
                where: {
                    id: parseInt(postId),
                    groupId: parseInt(groupId),
                    isApproved: false
                },
            })

            if (!postToDelete) return next(createError(500, "No post to refuse"))

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

            const post = await Post.model.delete({
                where: {
                    id: parseInt(postId),
                    groupId: parseInt(groupId),
                },
            })

            if (!post) return next(createError(500, "Error when refuse post"))

            res.status(200).json(post)
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when refuse post"))
        }
    }
}

module.exports = groupController