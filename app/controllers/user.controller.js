const createError = require("http-errors");
const prisma = require("../services/prisma");
const bcrypt = require("bcrypt")
const { getInfoUser, getRequestProfileUser } = require("../utils/helper.util");
const { userSchema } = require("../utils/validation.util");
const UserRelation = require("../models/users/user.relation.model");
const User = require("../models/users/user.model");
const Notify = require("../models/notify.model");
const { TypeNotify, FriendRequestStatus } = require("@prisma/client");
const { deleteImageFromCloudinary } = require("../utils/cloudinary/delete.util");
const Conversation = require("../models/chat/conversation.model");

const getStateRelation = async (userCurrentId, userTargetId) => {
    try {
        if (userCurrentId == userTargetId) return ["OWN"]
        const relation = await prisma.userRelation.findFirst({
            where: {
                userSendId: parseInt(userCurrentId),
                userReciveId: parseInt(userTargetId)
            }
        })

        let relations = []

        if (relation) {
            if (relation.isBlock) {
                return ["BLOCKING"]
            }

            if (relation.isFriend) {
                relations.push("FRIEND")
            }

            if (relation.friendRequestStatus == FriendRequestStatus.PENDING && !relation.isFriend) {
                relations.push("PENDING")
            }

            if (relation.isFollow) {
                relations.push("FOLLOWING")
            }
        }

        const relationReverse = await prisma.userRelation.findFirst({
            where: {
                userSendId: parseInt(userTargetId),
                userReciveId: parseInt(userCurrentId)
            }
        })

        if (relationReverse) {
            if (relationReverse.isBlock) {
                return ["BLOCKED"]
            }

            if (relationReverse.isFriend) {
                if (!relations.includes("FRIEND")) {
                    relations.push("FRIEND")
                }
            }

            if (relationReverse.friendRequestStatus == FriendRequestStatus.PENDING && !relationReverse.isFriend) {
                relations.push("WAITING")
            }

            if (relationReverse.isFollow) {
                relations.push("FOLLOWED")
            }
        }

        if (relations.length == 0) {
            relations.push("NONE")
        }

        return relations
    } catch (e) {
        console.log(e)
    }
}

module.exports = {
    readNotication: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const notificationId = parseInt(req.params.notificationId);

            const notification = await prisma.notify.update({
                where: {
                    id: notificationId
                },
                data: {
                    read: true
                },
                include: {
                    groupSend: true,
                    userSend: {
                        include: {
                            userProfile: true
                        }
                    }
                }
            })

            if (notification.type == "ACCEPT_FRIEND" || notification.type == "ADD_FRIEND") {
                await prisma.notify.delete({
                    where: {
                        id: notification.id
                    }
                })
            }

            const io = req.app.get('socketio');


            io.to(`user_${userId}`).emit("readNotification", notification)

            res.status(200).json(notification)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    //--------- GET NOTIFICATION LIST ----------//
    getAllNotification: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);

            const notifications = await prisma.notify.findMany({
                where: {
                    userId
                },
                include: {
                    groupSend: true,
                    userSend: {
                        include: {
                            userProfile: true
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            })

            res.status(200).json(notifications)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    //--------- GET BLOCKING LIST ----------//
    getBlockingUser: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);

            const user = await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                include: {
                    sendRelations: true
                }
            });

            // .filter((e) => e.friendRequestStatus != FriendRequestStatus.NONE)

            // const sendIds = user.sendRelations?.map((e) => e.userReciveId);
            const blockingIds = user.sendRelations?.filter((e) => e.isBlock).map((e) => e.userReciveId);


            const userBlockings = await prisma.user.findMany({
                where: {
                    AND: [
                        { id: { in: blockingIds } }
                    ],
                },
                include: {
                    userProfile: true,
                }
            });

            const result = await Promise.all(
                userBlockings.map(async (userTarget) => {
                    const relation = await getStateRelation(userId, userTarget.id);
                    return {
                        ...userTarget,
                        relation,
                    };
                })
            );

            res.status(200).json(result);

        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //--------- GET Friend ----------//
    getFriends: async (req, res, next) => {
        try {
            const userOtherId = req.params.userId;
            const userOwnId = parseInt(req.payload.aud);

            let userId = userOtherId ? parseInt(userOtherId) : userOwnId;

            if (!userId) return next(createError(400))

            const user = await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                include: {
                    sendRelations: true,
                    reciveRelations: true
                }
            });

            // .filter((e) => e.friendRequestStatus != FriendRequestStatus.NONE)

            const reciveIds = user.sendRelations?.filter((e) => e.friendRequestStatus == FriendRequestStatus.ACCEPTED && !e.isBlock && e.isFriend).map((e) => e.userReciveId);
            const sendIds = user.reciveRelations?.filter((e) => e.friendRequestStatus == FriendRequestStatus.ACCEPTED && !e.isBlock && e.isFriend).map((e) => e.userSendId);


            const userFriend = await prisma.user.findMany({
                where: {
                    AND: [
                        { id: { not: userId }, },
                    ],
                    OR: [
                        { id: { in: sendIds } },
                        { id: { in: reciveIds } },
                    ],
                },
                include: {
                    userProfile: true,
                }
            });

            const result = await Promise.all(
                userFriend.map(async (userTarget) => {
                    const relation = await getStateRelation(userOwnId, userTarget.id);
                    return {
                        ...userTarget,
                        relation,
                    };
                })
            );

            // SUCCESSFULL
            const userOwn = result.find((user) => user.id === userOwnId);

            if (userOwn) {
                const filteredResult = result.filter((user) => user.id !== userOwnId);
                res.status(200).json([userOwn, ...filteredResult]);
            } else {
                res.status(200).json(result);
            }
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    // ------------ GET USER FOLLOWING -----------//
    getFollowingUser: async (req, res, next) => {
        try {
            const userOwnId = parseInt(req.payload.aud);
            const userFetchId = req.params.userId;

            let userId = userFetchId ? parseInt(userFetchId) : userOwnId;

            const user = await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                include: {
                    sendRelations: true
                }
            });

            // .filter((e) => e.friendRequestStatus != FriendRequestStatus.NONE)

            // const sendIds = user.sendRelations?.map((e) => e.userReciveId);
            const followingIds = user.sendRelations?.filter((e) => !e.isBlock && e.isFollow).map((e) => e.userReciveId);


            const userFollowing = await prisma.user.findMany({
                where: {
                    AND: [
                        { id: { in: followingIds } }
                    ],
                },
                include: {
                    userProfile: true,
                }
            });

            const result = await Promise.all(
                userFollowing.map(async (userTarget) => {
                    const relation = await getStateRelation(userOwnId, userTarget.id);
                    return {
                        ...userTarget,
                        relation,
                    };
                })
            );

            // SUCCESSFULL
            const userOwn = result.find((user) => user.id === userOwnId);

            if (userOwn) {
                const filteredResult = result.filter((user) => user.id !== userOwnId);
                res.status(200).json([userOwn, ...filteredResult]);
            } else {
                res.status(200).json(result);
            }
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    // ------------ GET USER FOLLOWER -----------//
    getFollowerUser: async (req, res, next) => {
        try {
            const userOwnId = parseInt(req.payload.aud);
            const userFetchId = req.params.userId;

            let userId = userFetchId ? parseInt(userFetchId) : userOwnId;

            const user = await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                include: {
                    reciveRelations: true
                }
            });

            // .filter((e) => e.friendRequestStatus != FriendRequestStatus.NONE)

            // const sendIds = user.sendRelations?.map((e) => e.userReciveId);
            const followerIds = user.reciveRelations?.filter((e) => !e.isBlock && e.isFollow).map((e) => e.userSendId);


            const followers = await prisma.user.findMany({
                where: {
                    AND: [
                        { id: { in: followerIds } }
                    ],
                },
                include: {
                    userProfile: true,
                }
            });

            const result = await Promise.all(
                followers.map(async (userTarget) => {
                    const relation = await getStateRelation(userOwnId, userTarget.id);
                    return {
                        ...userTarget,
                        relation,
                    };
                })
            );

            // SUCCESSFULL
            const userOwn = result.find((user) => user.id === userOwnId);

            if (userOwn) {
                const filteredResult = result.filter((user) => user.id !== userOwnId);
                res.status(200).json([userOwn, ...filteredResult]);
            } else {
                res.status(200).json(result);
            }
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //--------- GET USER WAITING ----------//
    getWaitingUser: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);

            const user = await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                include: {
                    reciveRelations: true
                }
            });

            // .filter((e) => e.friendRequestStatus != FriendRequestStatus.NONE)

            // const sendIds = user.sendRelations?.map((e) => e.userReciveId);
            const sendIds = user.reciveRelations?.filter((e) => e.friendRequestStatus == FriendRequestStatus.PENDING && !e.isBlock && !e.isFriend).map((e) => e.userSendId);


            const userSend = await prisma.user.findMany({
                where: {
                    AND: [
                        { id: { not: userId } },
                        { id: { in: sendIds } }
                    ],
                },
                include: {
                    userProfile: true,
                }
            });

            const result = await Promise.all(
                userSend.map(async (userTarget) => {
                    const relation = await getStateRelation(userId, userTarget.id);
                    return {
                        ...userTarget,
                        relation,
                    };
                })
            );

            // SUCCESSFULL
            res.status(200).json(result);
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //--------- GET USER ----------//
    getRecommend: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);

            const user = await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                include: {
                    sendRelations: true,
                    reciveRelations: true
                }
            });

            // .filter((e) => e.friendRequestStatus != FriendRequestStatus.NONE)

            const sendIds = user.sendRelations?.map((e) => e.userReciveId);
            const reciveIds = user.reciveRelations?.map((e) => e.userSendId);


            const userRecommend = await prisma.user.findMany({
                where: {
                    AND: [
                        { id: { not: userId } },

                        { id: { notIn: sendIds } },
                        { id: { notIn: reciveIds } }
                    ],
                },
                include: {
                    userProfile: true,
                }
            });

            const result = await Promise.all(
                userRecommend.map(async (userTarget) => {
                    const relation = await getStateRelation(userId, userTarget.id);
                    return {
                        ...userTarget,
                        relation,
                    };
                })
            );

            // SUCCESSFULL
            res.status(200).json(result);
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //--------- GET USER ----------//
    getUser: async (req, res, next) => {
        try {
            const userId = parseInt(req.params.userId);
            const userFetchId = parseInt(req.payload.aud);
            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                include: {
                    userProfile: true
                }
            });
            const userInfo = getInfoUser(user);
            const relation = await getStateRelation(userFetchId, user.id);

            // SUCCESSFULL
            res.status(200).json({
                ...userInfo,
                relation
            });
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
            const userId = parseInt(req.payload.aud);
            const profileUser = getRequestProfileUser(req);
            const file = req.file
            const oldProfile = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                include: {
                    userProfile: true
                }
            })

            if (oldProfile.userProfile.avatar && file) {
                await deleteImageFromCloudinary(oldProfile.userProfile.avatar);
            }

            const userProfileUpdated = await prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    userProfile: {
                        update: {
                            avatar: file?.path ?? oldProfile.userProfile.avatar,
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

            const result = await getStateRelation(userSendId, userReciveId);

            // socket to reciveUser
            // const notify = new Notify({
            //     userId: userReciveId,
            //     message: `${userSend.userProfile.fullname} đã gửi lời mời kết bạn`,
            //     type: TypeNotify.ADD_FRIEND
            // })

            const notify = await prisma.notify.create({
                data: {
                    link: "",
                    message: "đã gửi lời mời kết bạn",
                    type: "ADD_FRIEND",
                    userId: userReciveId,
                    userSendId: userSendId,
                },
                include: {
                    userSend: {
                        include: {
                            userProfile: true
                        }
                    },
                    groupSend: true
                }
            })

            const io = req.app.get("socketio")

            io.to(`user_${userReciveId}`).emit('newNotification', notify)

            const relationRecived = await getStateRelation(userReciveId, userSendId);

            io.to(`user_${userReciveId}`).emit('sendRelation', relationRecived)

            res.status(200).json(result);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when send inviting addfriend"));
        }
    },
    //------------- REMOVE INVITE ADDING ---------//
    removeInvite: async (req, res, next) => {
        try {
            const userReciveId = parseInt(req.params.reciveId);
            const userSendId = parseInt(req.payload.aud);
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

            const result = await getStateRelation(userSendId, userReciveId);

            await prisma.notify.deleteMany({
                where: {
                    userId: userReciveId,
                    userSendId: userSendId,
                    type: "ADD_FRIEND"
                }
            })
            const io = req.app.get("socketio")

            const relationRecived = await getStateRelation(userReciveId, userSendId);

            io.to(`user_${userReciveId}`).emit('sendRelation', relationRecived)


            res.status(200).json(result);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when remove invite"));
        }
    },
    //------------- ACCEPT FRIEND ------------- //
    acceptFriend: async (req, res, next) => {
        try {
            const userSendId = parseInt(req.params.senderId);
            const userReciveId = parseInt(req.payload.aud);
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

            const result = await getStateRelation(userReciveId, userSendId);

            const existingConversation = await Conversation.findConversationBetweenUsers(userReciveId, userSendId);

            if (!existingConversation) {
                // Tạo cuộc trò chuyện mới
                const conversation = new Conversation({
                    name: "",
                    userIds: [userReciveId, userSendId],
                    adminIds: [userReciveId, userSendId],
                    isGroup: false
                });

                await conversation.save();
            }

            await prisma.notify.deleteMany({
                where: {
                    userId: userReciveId,
                    userSendId: userSendId,
                    type: "ADD_FRIEND"
                }
            })

            const notify = await prisma.notify.create({
                data: {
                    link: "",
                    message: "đã chấp nhận lời mời kết bạn",
                    type: "ACCEPT_FRIEND",
                    userId: userSendId,
                    userSendId: userReciveId,
                },
                include: {
                    userSend: {
                        include: {
                            userProfile: true
                        }
                    },
                    groupSend: true
                }
            })

            const io = req.app.get("socketio")

            io.to(`user_${userSendId}`).emit('newNotification', notify)

            const relationRecived = await getStateRelation(userSendId, userReciveId);

            io.to(`user_${userSendId}`).emit('sendRelation', relationRecived)

            res.status(200).json(result);
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when accept friend"))
        }
    },
    //----------- NOT ACCEPT ---------//
    denyUser: async (req, res, next) => {
        try {
            const userSendId = parseInt(req.params.senderId);
            const userReciveId = parseInt(req.payload.aud);
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

            const result = await getStateRelation(userReciveId, userSendId);

            await prisma.notify.deleteMany({
                where: {
                    userId: userReciveId,
                    userSendId: userSendId,
                    type: "ADD_FRIEND"
                }
            })

            const io = req.app.get("socketio")


            const relationRecived = await getStateRelation(userSendId, userReciveId);

            io.to(`user_${userSendId}`).emit('sendRelation', relationRecived)

            res.status(200).json(result);
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

            const result = await getStateRelation(userSendId, userReciveId);

            // Notify send user
            const io = req.app.get("socketio")

            const relationRecived = await getStateRelation(userReciveId, userSendId);

            io.to(`user_${userReciveId}`).emit('sendRelation', relationRecived)

            res.status(200).json(result);
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

            const result = await getStateRelation(userSendId, userReciveId);

            res.status(200).json(result);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when follow user"))
        }
    },
    //----------- BLOCK USER ---------//
    blockUser: async (req, res, next) => {
        try {
            const userSendId = parseInt(req.payload.aud);
            const userReciveId = parseInt(req.params.reciveId);
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

            const result = await getStateRelation(userSendId, userReciveId);

            const conversation = await prisma.conversation.findFirst({
                where: {
                    isGroup: false,
                    user: {
                        every: {
                            id: {
                                in: [userSendId, userReciveId]
                            }
                        }
                    }
                }
            })

            const io = req.app.get('socketio');

            io.to(`user_${userReciveId}`).emit('blockUser', { conversation, stateBlock: isBlock ? "BLOCKED" : "NONE" })

            const relationRecived = await getStateRelation(userReciveId, userSendId);

            io.to(`user_${userReciveId}`).emit('sendRelation', relationRecived)

            res.status(200).json(result);
        } catch (e) {
            console.log(e);
            next(createError(500, "Error when block user"))
        }
    },
}