const createError = require("http-errors");
const Group = require("../models/groups/group.model");
const { deleteImageFromCloudinary } = require("../utils/cloudinary/delete.util");
const { StateAttendGroup } = require("@prisma/client");
const UserAttendGroup = require("../models/groups/user.attend.group.model");

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
    //------------ CREATE GROUP ---------------//
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
    //------------ CREATE GROUP ---------------//
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
}

module.exports = groupController