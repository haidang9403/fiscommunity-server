const createError = require("http-errors");
const prisma = require("../services/prisma");
const { getStateRelation, getPermissionGroup, getStateInGroup } = require("../utils/helper.util");
const Post = require("../models/post.model");
const { UploadPostWhere } = require("@prisma/client");

module.exports = {
    searchPeople: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const q = req.query.q;

            if (!q) {
                return next(createError(400, "Missing search query"));
            }

            const people = await prisma.user.findMany({
                where: {
                    OR: [
                        {
                            userProfile: {
                                fullname: {
                                    contains: q,
                                    mode: 'insensitive',
                                },
                            },
                        },
                        {
                            email: {
                                contains: q,
                                mode: 'insensitive',
                            },
                        },
                        {
                            phone: {
                                contains: q,
                                mode: 'insensitive',
                            },
                        },
                    ],
                },
                include: {
                    userProfile: true,
                },
                orderBy: {
                    createdAt: "desc"
                }
            });

            const resAll = await Promise.all(
                people.map(async (user) => {
                    const relation = await getStateRelation(userId, user.id);

                    if (relation.includes("BLOCKING") || relation.includes("BLOCKED")) {
                        return null
                    }

                    return {
                        ...user,
                        relation
                    }
                })
            )

            const resValid = resAll.filter(e => e)

            res.status(200).send(resValid)

        } catch (e) {
            console.log(e);
            return next(createError(500))
        }
    },
    searchGroups: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud)
            const q = req.query.q;

            if (!q || q.trim() === '') {
                return res.status(400).send({ message: "No search query provided" });
            }

            const groups = await prisma.group.findMany({
                where: {
                    OR: [
                        {
                            groupName: {
                                contains: q,
                                mode: 'insensitive',
                            },
                        },
                    ],
                },
                include: {
                    owner: true,
                },
                orderBy: {
                    createdAt: "desc"
                }
            });

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
            console.log(e);
            return next(createError(500));
        }
    },
    searchPosts: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud)
            const q = req.query.q;

            if (!q || q.trim() === '') {
                return res.status(400).send({ message: "No search query provided" });
            }

            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                include: {
                    reciveRelations: true,
                    sendRelations: true
                }
            })

            const sendIds = user.reciveRelations.filter((relation) => !relation.isBlock && relation.isFriend).map((relation) => relation.userSendId)
            const reciveIds = user.sendRelations.filter((relation) => !relation.isBlock && (relation.isFriend || relation.isFollow)).map((relation) => relation.userReciveId)


            const groups = await prisma.userAttendGroup.findMany({
                where: {
                    userId: parseInt(userId),
                    state: "ACCEPTED",
                    permission: {
                        not: "NONE"
                    }
                }
            })


            const groupIds = groups.map((group) => group.groupId)

            const post = await Post.model.findMany({
                where: {
                    AND: [
                        {
                            OR: [
                                {
                                    from: UploadPostWhere.GROUP,
                                    isApproved: true,
                                    groupId: { in: groupIds }
                                },
                                {
                                    from: UploadPostWhere.USER,
                                    ownerId: { in: [...sendIds, ...reciveIds] }
                                },
                                {
                                    privacy: "PUBLIC",
                                    ownerId: {
                                        not: userId
                                    }
                                },
                            ]
                        },
                        {
                            OR: [
                                {
                                    owner: {
                                        userProfile: {
                                            fullname: {
                                                contains: q,
                                                mode: 'insensitive',
                                            },
                                        },
                                    }
                                },
                                {
                                    owner: {
                                        email: {
                                            contains: q,
                                            mode: 'insensitive',
                                        },
                                    }
                                },
                                {
                                    content: {
                                        contains: q,
                                        mode: 'insensitive',
                                    }
                                },
                            ]
                        }
                    ]
                },
                include: {
                    comments: {
                        where: {
                            replyId: null
                        },
                        include: {
                            userLikes: true,
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                            replies: true
                        },
                        orderBy: [
                            { like: "desc" },
                            { createdAt: "desc" }
                        ]
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
                    group: true
                },
                orderBy: {
                    createdAt: "desc"
                },
                take: 20,
                skip: 0
            })

            res.status(200).json(post)
        } catch (e) {
            console.log(e);
            return next(createError(500));
        }
    }
}