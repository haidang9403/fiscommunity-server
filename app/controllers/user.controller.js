const createError = require("http-errors");
const prisma = require("../services/prisma");
const bcrypt = require("bcrypt")
const { getInfoUser, getRequestProfileUser } = require("../utils/helper.util");
const { userSchema } = require("../utils/validation.util");
const UserRelation = require("../models/users/user.relation.model");
const User = require("../models/users/user.model");
const Notify = require("../models/notify.model");
const { TypeNotify } = require("@prisma/client");

module.exports = {
    //--------- GET USER ----------//
    getUser: async (req, res, next) => {
        try {
            const userId = parseInt(req.params.userId);
            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                include: {
                    userProfile: true
                }
            });
            const userInfo = getInfoUser(user);

            // SUCCESSFULL
            res.status(200).json(userInfo);
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //----------- GET ALL USER ------------ //
    getAllUser: async (req, res, next) => {
        try {
            const allUsers = await prisma.user.findMany();

            res.status(200).json(allUsers);
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //--------- UPDATE PROFILE USER ----------- //
    updateProfile: async (req, res, next) => {
        try {
            const userId = parseInt(req.params.userId);
            const profileUser = getRequestProfileUser(req);
            const userProfileUpdated = await prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    userProfile: {
                        update: {
                            ...profileUser
                        }
                    }
                },
                include: {
                    userProfile: true
                }
            });

            res.status(200).json(userProfileUpdated.userProfile);
        } catch (e) {
            console.log(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //----------- CHANGE PASSWORD ---------- //
    changePassword: async (req, res, next) => {
        try {
            const { oldPassword, newPassword, confirmPassword } = req.body;
            const userId = parseInt(req.params.userId);

            // Validate
            await userSchema.changePassword.validate(
                { oldPassword, newPassword, confirmPassword },
                { context: { userId } }
            )

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword }
            });

            res.status(200).json({ success: true, message: "Mật khẩu đã được thay đổi thành công" });
        } catch (e) {
            e.one = true;
            next(e);
        }
    },
    //----------- ADD FRIEND ------------- //
    addFriend: async (req, res, next) => {
        try {
            const userSendId = parseInt(req.payload.aud);
            const userReciveId = parseInt(req.params.reciveId);
            const friendRequestStatus = 'PENDING';

            const isValidReciveUser = await User.isValidUser(userReciveId);
            if (!isValidReciveUser) {
                throw createError(404, "User not found")
            }

            const isBlocked = await UserRelation.isBlocked(userSendId, userReciveId)
            if (isBlocked) {
                return next(createError(403, "Hành động với người dùng đang bị chặn"))
            }

            const isAddedFriend = await UserRelation.isAddedFriend(userSendId, userReciveId);
            if (isAddedFriend) {
                return next(createError(403, "Đã là bạn bè"))
            }

            const isPedding = await UserRelation.isPedding(userReciveId, userSendId);
            if (isPedding) {
                return next(createError(400, "Người dùng đã gửi lời mời"))
            }


            const userRelation = new UserRelation({ userSendId, userReciveId, friendRequestStatus })
            const relationSaved = await userRelation.save();
            if (!relationSaved) {
                throw createError(400, "Add friend failed")
            }

            const userSend = await User.model.findUnique({
                where: {
                    id: parseInt(userSendId)
                },
                include: {
                    userProfile: true
                }
            })

            // socket to reciveUser
            // const notify = new Notify({
            //     userId: userReciveId,
            //     message: `${userSend.userProfile.fullname} đã gửi lời mời kết bạn`,
            //     type: TypeNotify.ADD_FRIEND
            // })

            const io = req.app.get("socketio")

            // io.to(`user_${userReciveId}`).emit('newNotification', notify)

            res.status(200).json(relationSaved);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when send inviting addfriend"));
        }
    },
    //------------- REMOVE INVITE ADDING ---------//
    removeInvite: async (req, res, next) => {
        try {
            const userReciveId = req.params.reciveId;
            const userSendId = req.payload.aud;
            const friendRequestStatus = 'NONE';

            const isValidReciveUser = await User.isValidUser(userReciveId);
            if (!isValidReciveUser) {
                throw createError(404, "User not found")
            }

            const isBlocked = await UserRelation.isBlocked(userSendId, userReciveId)
            if (isBlocked) {
                return next(createError(403, "Hành động với người dùng đang bị chặn"))
            }

            const isPedding = await UserRelation.isPedding(userSendId, userReciveId);
            if (!isPedding) {
                return next(createError(400, "Người dùng chưa gửi lời mời"))
            }


            const userRelation = new UserRelation({ userSendId, userReciveId, friendRequestStatus })
            const relationSaved = await userRelation.save();
            if (!relationSaved) {
                throw createError(400, "Remove invite adding friend failed")
            }

            // socket to reciveUser


            res.status(200).json(relationSaved);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when remove invite"));
        }
    },
    //------------- ACCEPT FRIEND ------------- //
    acceptFriend: async (req, res, next) => {
        try {
            const userSendId = req.params.senderId;
            const userReciveId = req.payload.aud;
            const friendRequestStatus = 'ACCEPTED';
            const isFriend = true;

            const isValidSender = await User.isValidUser(userSendId);
            if (!isValidSender) {
                throw createError(404, "User not found")
            }

            const isBlocked = await UserRelation.isBlocked(userSendId, userReciveId)
            if (isBlocked) {
                return next(createError(403, "Hành động với người dùng đang bị chặn"))
            }

            const isPedding = await UserRelation.isPedding(userSendId, userReciveId);
            if (!isPedding) {
                return next(createError(400, "Người dùng chưa gửi lời mời"))
            }

            const userRelation = new UserRelation({ userSendId, userReciveId, isFriend, friendRequestStatus })
            const relationSaved = await userRelation.save();
            if (!relationSaved) {
                throw createError(400, "Accept friend failed")
            }

            // Notify send user

            res.status(200).json(relationSaved);
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when accept friend"))
        }
    },
    //----------- NOT ACCEPT ---------//
    denyUser: async (req, res, next) => {
        try {
            const userSendId = req.params.senderId;
            const userReciveId = req.payload.aud;
            const friendRequestStatus = 'DELETED';
            const isFriend = false;

            const isValidUser = await User.isValidUser(userReciveId);
            if (!isValidUser) {
                throw createError(404, "User not found")
            }

            const isBlocked = await UserRelation.isBlocked(userSendId, userReciveId)
            if (isBlocked) {
                return next(createError(403, "Hành động với người dùng đang bị chặn"))
            }

            const isPedding = await UserRelation.isPedding(userSendId, userReciveId);
            if (!isPedding) {
                return next(createError(400, "Người dùng chưa gửi lời mời"))
            }

            const userRelation = new UserRelation({ userSendId, userReciveId, isFriend, friendRequestStatus })
            const relationSaved = await userRelation.save();
            if (!relationSaved) {
                throw createError(400, "Deny friend failed")
            }

            // Notify send user

            res.status(200).json(relationSaved);
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when accept friend"))
        }
    },
    //----------- UNFRIEND ---------//
    unfriend: async (req, res, next) => {
        try {
            const userReciveId = req.params.reciveId;
            const userSendId = req.payload.aud;
            const friendRequestStatus = 'DELETED';
            const isFriend = false;

            const isValidUser = await User.isValidUser(userReciveId);
            if (!isValidUser) {
                throw createError(404, "User not found")
            }

            const isBlocked = await UserRelation.isBlocked(userSendId, userReciveId)
            if (isBlocked) {
                return next(createError(403, "Hành động với người dùng đang bị chặn"))
            }

            const isAddedFriend = await UserRelation.isAddedFriend(userSendId, userReciveId);
            if (!isAddedFriend) {
                return next(createError(403, "Chưa là bạn bè"))
            }

            const userRelation = new UserRelation({ userSendId, userReciveId, isFriend, friendRequestStatus })
            const relationSaved = await userRelation.save();
            if (!relationSaved) {
                throw createError(400, "Unfriend friend failed")
            }

            // Notify send user

            res.status(200).json(relationSaved);
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when accept friend"))
        }
    },
    //----------- FOLLOW USER ---------//
    followUser: async (req, res, next) => {
        try {
            const userSendId = req.payload.aud;
            const userReciveId = req.params.reciveId;
            const isFollow = req.body.isFollow;

            const isValidReciveUser = await User.isValidUser(userReciveId);
            if (!isValidReciveUser) {
                throw createError(404, "User not found")
            }

            const isBlocked = await UserRelation.isBlocked(userSendId, userReciveId);
            if (isBlocked) {
                throw createError(403, "Hành động với người dùng đang bị chặn")
            }

            const userRelation = new UserRelation({ userSendId, userReciveId, isFollow })
            const relationSaved = await userRelation.save();
            if (!relationSaved) {
                throw createError(400, "Action failed")
            }

            res.status(200).json(relationSaved);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when follow user"))
        }
    },
    //----------- BLOCK USER ---------//
    blockUser: async (req, res, next) => {
        try {
            const userSendId = req.payload.aud;
            const userReciveId = req.params.reciveId;
            const isBlock = req.body.isBlock;

            const isValidReciveUser = await User.isValidUser(userReciveId);
            if (!isValidReciveUser) {
                throw createError(404, "User not found")
            }

            const userRelation = new UserRelation({ userSendId, userReciveId, isBlock })
            const relationSaved = await userRelation.save();
            if (!relationSaved) {
                throw createError(400, "Action failed")
            }

            res.status(200).json(relationSaved);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when block user"))
        }
    },
}