const createError = require("http-errors");
const Group = require("../models/groups/group.model");
const { deleteImageFromCloudinary, deleteMediaFromCloudinary } = require("../utils/cloudinary/delete.util");
const { StateAttendGroup, GroupPermission } = require("@prisma/client");
const UserAttendGroup = require("../models/groups/user.attend.group.model");
const Post = require("../models/post.model");
const Media = require("../models/media.model");
const prisma = require("../services/prisma");
const { getPermissionGroup, getStateInGroup, getStateRelation } = require("../utils/helper.util");
const { connect } = require("socket.io-client");
const { parse } = require("dotenv");

const groupController = {
    //-------- CHANGE PERMISSION ---------//
    changePermission: async (req, res, next) => {
        try {
            const userAuthId = parseInt(req.payload.aud);
            const groupId = parseInt(req.params.groupId);
            const userId = parseInt(req.params.userId);
            const permission = req.body.permission;

            const group = await prisma.group.findUnique({
                where: {
                    id: groupId
                }
            })

            if (!group) return next(createError(404))

            const permissionAuth = await getPermissionGroup(userAuthId, groupId);

            const permissionUser = await getPermissionGroup(userId, groupId)

            if (permissionAuth == GroupPermission.NONE) return next(createError(403))

            if (userId != userAuthId && permissionAuth != GroupPermission.ADMIN) return next(createError(403))

            if (userId == userAuthId && permissionAuth != GroupPermission.ADMIN && permission != GroupPermission.NONE) return next(createError(403))

            if (userId == group.ownerId) return next(createError(403))

            if (permissionUser == GroupPermission.ADMIN && userAuthId != group.ownerId) return next(createError(403))

            if (permission == GroupPermission.NONE) {
                const userAttendGroup = await prisma.userAttendGroup.delete({
                    where: {
                        groupId_userId: {
                            groupId,
                            userId
                        }
                    }
                })

                const groupOld = await prisma.userAttendGroup.findMany({
                    where: {
                        groupId
                    },
                })

                if (groupOld.length == 0) await prisma.group.delete({
                    where: {
                        id: groupId
                    }
                })

                return res.status(200).json(userAttendGroup)
            } else {
                if (![GroupPermission.ADMIN, GroupPermission.MEMBER, GroupPermission.READER].includes(permission)) return next(createError(400))
                const userAttendGroup = await prisma.userAttendGroup.update({
                    where: {
                        groupId_userId: {
                            groupId,
                            userId
                        }
                    },
                    data: {
                        permission
                    },
                    include: {
                        user: {
                            include: {
                                userProfile: true
                            }
                        }
                    }
                })

                return res.status(200).json(userAttendGroup)
            }

        } catch (e) {
            console.log(e);
            return next(createError(500))
        }
    },
    //-------------- GET REQUEST ---------------//
    getRequest: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const groupId = parseInt(req.params.groupId);

            const group = await prisma.group.findUnique({
                where: {
                    id: groupId
                },
                include: {
                    users: {
                        where: {
                            state: StateAttendGroup.ACCEPTED
                        }
                    }
                }
            })

            if (!group) return next(createError(404))

            const requests = await prisma.userAttendGroup.findMany({
                where: {
                    groupId: parseInt(groupId),
                    state: "PENDING",
                },
                include: {
                    user: {
                        include: {
                            userProfile: true
                        }
                    }
                }
            })

            const temp = await Promise.all(
                requests.map(async (request) => {
                    const relation = await getStateRelation(userId, request.userId)
                    if (relation.includes("BLOCKED") || relation.includes("BLOCKING")) {
                        return null
                    }
                    return request
                })
            )

            const requestValid = temp.filter((e) => e)

            res.status(200).json(requestValid)
        } catch (e) {
            console.log(e);
            return next(createError(500))
        }
    },
    getOneGroup: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const groupId = parseInt(req.params.groupId);

            const group = await prisma.group.findUnique({
                where: {
                    id: groupId
                },
                include: {
                    users: {
                        where: {
                            state: StateAttendGroup.ACCEPTED
                        },
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                },
                            }
                        }
                    }
                }
            })

            if (!group) return next(createError(404))

            const permission = await getPermissionGroup(userId, groupId);
            const state = await getStateInGroup(userId, groupId)

            res.status(200).json({
                ...group,
                permission,
                state
            })

        } catch (e) {
            console.log(e);
            return next(createError(500))
        }
    },
    //--------------- GET GROUP OF USER -----------//
    getGroupUser: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);

            const groupAttend = await prisma.userAttendGroup.findMany({
                where: {
                    userId: parseInt(userId),
                    state: StateAttendGroup.ACCEPTED
                }
            })

            const groupAttendIds = groupAttend.map((group) => group.groupId)

            const groups = await prisma.group.findMany({
                where: {
                    id: {
                        in: groupAttendIds
                    }
                },
                include: {
                    users: {
                        where: {
                            state: StateAttendGroup.ACCEPTED
                        }
                    }
                }
            })

            const groupWithPermission = await Promise.all(
                groups.map(async (group) => {
                    const permission = await getPermissionGroup(userId, group.id)
                    const state = await getStateInGroup(userId, group.id)
                    return {
                        ...group,
                        permission,
                        state
                    }
                })
            )

            res.status(200).json(groupWithPermission)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when create group"))
        }
    },
    //------------ GET GROUP DISCOVER ---------------//
    getDiscover: async (req, res, next) => {
        try {
            const userId = req.payload.aud;

            const groupAttend = await prisma.userAttendGroup.findMany({
                where: {
                    userId: parseInt(userId),
                }
            })

            const groupAttendIds = groupAttend.map((group) => group.groupId)

            const groups = await prisma.group.findMany({
                where: {
                    id: {
                        notIn: groupAttendIds
                    }
                },
                include: {
                    users: {
                        where: {
                            state: StateAttendGroup.ACCEPTED
                        }
                    }
                }
            })

            const groupWithPermission = await Promise.all(
                groups.map(async (group) => {
                    const permission = await getPermissionGroup(userId, group.id)
                    const state = await getStateInGroup(userId, group.id)
                    return {
                        ...group,
                        permission,
                        state
                    }
                })
            )

            res.status(200).json(groupWithPermission)

        } catch (e) {
            console.log(e)
            next(createError(500, "Error when create group"))
        }
    },
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
            const userId = parseInt(req.payload.aud)
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

            const groupRes = await prisma.group.findUnique({
                where: {
                    id: groupSaved.id
                },
                include: {
                    users: {
                        where: {
                            state: StateAttendGroup.ACCEPTED
                        },
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                },
                            }
                        }
                    }
                }
            })

            const permission = await getPermissionGroup(userId, groupSaved.id);
            const state = await getStateInGroup(userId, groupSaved.id)

            res.status(200).json({
                ...groupRes,
                permission,
                state
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

            const resAttend = await prisma.userAttendGroup.findUnique({
                where: {
                    groupId_userId: {
                        userId: parseInt(userId),
                        groupId: parseInt(groupId)
                    }
                },
                include: {
                    user: {
                        include: {
                            userProfile: true
                        }
                    }
                }
            })

            const userAdmins = await prisma.userAttendGroup.findMany({
                where: {
                    groupId: parseInt(groupId),
                    permission: "ADMIN",
                },
            })

            const group = await prisma.group.findUnique({
                where: {
                    id: parseInt(groupId)
                }
            })

            const io = req.app.get("socketio")

            userAdmins.forEach(async (admin) => {
                const notify = await prisma.notify.create({
                    data: {
                        link: "groupId=" + groupId,
                        message: "đã gửi yêu cầu tham gia nhóm " + group.groupName,
                        type: "REQUEST_GROUP",
                        userId: admin.userId,
                        userSendId: parseInt(userId),
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
                io.to(`user_${admin.userId}`).emit("newNotification", notify)
                io.to(`user_${admin.userId}`).emit("newRequestAttendGroup", resAttend)
            })

            res.send(userAttendGroupSaved)

        } catch (e) {
            console.log(e)
            next(createError(500, "Error when request to attend group"))
        }
    },
    //------------ REQUEST ATTEND GROUP ---------------//
    canceltAttend: async (req, res, next) => {
        try {
            const groupId = parseInt(req.params.groupId);
            const userId = parseInt(req.payload.aud);

            const isPenddingAttend = await UserAttendGroup.isPendding({ groupId, userId })

            if (!isPenddingAttend) return next(createError(400))


            const resAttend = await prisma.userAttendGroup.findUnique({
                where: {
                    groupId_userId: {
                        userId: parseInt(userId),
                        groupId: parseInt(groupId)
                    }
                },
                include: {
                    user: {
                        include: {
                            userProfile: true
                        }
                    }
                }
            })

            const deletedAttend = await prisma.userAttendGroup.delete({
                where: {
                    groupId_userId: {
                        groupId,
                        userId
                    }
                }
            })



            const userAdmins = await prisma.userAttendGroup.findMany({
                where: {
                    groupId: parseInt(groupId),
                    permission: "ADMIN",
                },
            })

            const group = await prisma.group.findUnique({
                where: {
                    id: parseInt(groupId)
                }
            })

            const io = req.app.get("socketio")

            userAdmins.forEach(async (admin) => {
                const notify = await prisma.notify.deleteMany({
                    where: {
                        userId: admin.userId,
                        userSendId: parseInt(userId),
                        type: "REQUEST_GROUP"
                    }
                })

                io.to(`user_${admin.userId}`).emit("cancelRequestAttendGroup", resAttend)
            })

            res.send(deletedAttend)

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
            const userOwnId = parseInt(req.payload.aud)

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

            const resAttend = await prisma.userAttendGroup.findUnique({
                where: {
                    groupId_userId: {
                        userId: parseInt(userId),
                        groupId: parseInt(groupId)
                    }
                },
                include: {
                    user: {
                        include: {
                            userProfile: true
                        }
                    }
                }
            })

            const userAdmins = await prisma.userAttendGroup.findMany({
                where: {
                    groupId: parseInt(groupId),
                    permission: "ADMIN",
                },
            })

            const group = await prisma.group.findUnique({
                where: {
                    id: parseInt(groupId)
                }
            })

            const io = req.app.get("socketio")


            for (const admin of userAdmins) {
                const notify = await prisma.notify.deleteMany({
                    where: {
                        userId: admin.userId,
                        userSendId: parseInt(userId, 10),
                        type: "REQUEST_GROUP"
                    }
                });

                io.to(`user_${admin.userId}`).emit("cancelRequestAttendGroup", resAttend);
            }

            const notify = await prisma.notify.create({
                data: {
                    link: "groupId=" + groupId,
                    message: "Bạn đã trở thành thành viên của nhóm",
                    type: "REQUEST_GROUP",
                    userId: parseInt(userId),
                    groupSendId: parseInt(groupId),
                    userSendId: userOwnId
                },
                include: {
                    groupSend: true
                }
            })

            console.log(notify)

            io.to(`user_${userId}`).emit("newNotification", notify)


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
            const userAuthId = req.payload.aud;

            if (!groupId || !postId) return next(createError(400))

            const post = await Post.model.update({
                where: {
                    id: parseInt(postId),
                    groupId: parseInt(groupId),
                    isApproved: false
                },
                data: {
                    isApproved,
                    createdAt: new Date(Date.now())
                }
            })

            if (!post) return next(createError(400))

            const postData = await prisma.post.findUnique({
                where: {
                    id: post.id
                },
                include: {
                    comments: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                        },
                        orderBy: {
                            createdAt: "desc"
                        }
                    },
                    files: true,
                    folders: true,
                    userLikes: true,
                    userShare: true,
                    sharedPosts: true,
                    owner: {
                        include: {
                            userProfile: true
                        }
                    },
                    postShare: true,
                    media: true,
                    group: true,
                }
            })

            const userAdmins = await prisma.userAttendGroup.findMany({
                where: {
                    groupId: parseInt(postData.groupId),
                    permission: "ADMIN",
                },
            })
            const io = req.app.get("socketio")

            for (const admin of userAdmins) {
                io.to(`user_${admin.userId}`).emit("acceptPost", postData);
            }

            const notify = await prisma.notify.create({
                data: {
                    link: "groupId=" + groupId,
                    message: "Bài viết của bạn đã được duyệt trong nhóm",
                    type: "REQUEST_GROUP",
                    userId: postData.ownerId,
                    userSendId: parseInt(userAuthId),
                    groupSendId: postData.groupId
                },
                include: {
                    groupSend: true
                }
            })

            io.to(`user_${postData.ownerId}`).emit("acceptPost", postData);

            io.to(`user_${postData.ownerId}`).emit("newNotification", notify);

            res.status(200).json(postData)

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

            let result = 'ok';
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