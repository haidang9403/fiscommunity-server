const createError = require("http-errors");
const Post = require("../models/post.model");
const Media = require("../models/media.model");
const prisma = require("../services/prisma");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary/delete.util");
const { TypePost, UploadPostWhere, TypeGroup, TypePrivacy, FriendRequestStatus, GroupPermission, TypeMessage } = require("@prisma/client");
const Comment = require("../models/comment.model");
const Group = require("../models/groups/group.model");
const { getPermissionGroup } = require("../utils/helper.util");
const Message = require("../models/chat/message.model");
const Conversation = require("../models/chat/conversation.model");

const getStateRelation = async (userCurrentId, userTargetId) => {
    try {
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
        return null
    }
}

const postController = {
    getFeedUser: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);

            const limit = parseInt(req.query.limit) || 10;
            const offset = parseInt(req.query.offset) || 0;

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

            let post = [];
            post = await Post.model.findMany({
                where: {
                    OR: [
                        {
                            from: UploadPostWhere.GROUP,
                            isApproved: true,
                            groupId: { in: groupIds }
                        },
                        {
                            from: UploadPostWhere.USER,
                            ownerId: { in: [...sendIds, ...reciveIds] }
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
                take: limit,
                skip: offset
            })


            res.status(200).json(post)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    getFeedGroup: async (req, res, next) => {
        try {
            const userId = req.payload.aud;

            const limit = parseInt(req.query.limit) || 10;
            const offset = parseInt(req.query.offset) || 0;

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

            let post = [];
            post = await Post.model.findMany({
                where: {
                    from: UploadPostWhere.GROUP,
                    isApproved: true,
                    groupId: {
                        in: groupIds
                    }
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
                take: limit,
                skip: offset
            })


            res.status(200).json(post)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    getOnePostUser: async (req, res, next) => {
        try {
            const userFetchId = parseInt(req.payload.aud);
            const postId = parseInt(req.params.postId)

            const post = await Post.model.findUnique({
                where: {
                    from: UploadPostWhere.USER,
                    id: postId
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
                }
            })

            if (!post) return next(createError(400))

            const relation = userFetchId == post.ownerId ? ["OWN"] : await getStateRelation(userFetchId, post.ownerId);

            res.status(200).json({ post, relation })
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    //------- GET POST --------//
    getPost: async (req, res, next) => {
        try {
            const { userId } = req.params;

            const userFetchId = req.payload.aud;

            let post = [];

            if (userFetchId == userId) {

                post = await Post.model.findMany({
                    where: {
                        ownerId: parseInt(userId),
                        from: UploadPostWhere.USER,
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
                        postShare: {
                            include: {
                                media: true,
                                owner: {
                                    include: {
                                        userProfile: true
                                    }
                                },
                                files: true,
                                folders: true,

                            }
                        },
                        media: true,
                    },
                    orderBy: {
                        createdAt: "desc"
                    }
                })
            } else {
                const relation = await getStateRelation(userFetchId, userId);

                if (!relation) return next(createError(500));

                const isFriend = relation.includes("FRIEND");

                const isBlock = relation.includes("BLOCKED") || relation.includes("BLOCKING");

                if (isBlock) return next(createError(403, "Not access this user"))


                if (isFriend) {
                    post = await Post.model.findMany({
                        where: {
                            ownerId: parseInt(userId),
                            from: UploadPostWhere.USER,
                            OR: [
                                { privacy: TypePrivacy.FRIENDS },
                                { privacy: TypePrivacy.PUBLIC }
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
                        },
                        orderBy: {
                            createdAt: "desc"
                        }
                    })
                } else {
                    post = await Post.model.findMany({
                        where: {
                            ownerId: parseInt(userId),
                            from: UploadPostWhere.USER,
                            privacy: TypePrivacy.PUBLIC
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
                        },
                        orderBy: {
                            createdAt: "desc"
                        }
                    })
                }
            }


            res.status(200).json(post)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // ------- GET PENDING POST User -------
    getPendingPostUser: async (req, res, next) => {
        try {
            const userFetchId = parseInt(req.payload.aud);

            const groupId = parseInt(req.params.groupId);

            let post = [];
            post = await Post.model.findMany({
                where: {
                    from: UploadPostWhere.GROUP,
                    groupId,
                    ownerId: userFetchId,
                    isApproved: false
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
                }
            })


            res.status(200).json(post)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // ------- GET PENDING POST -------
    getPendingPostGroup: async (req, res, next) => {
        try {
            const userFetchId = req.payload.aud;

            const groupId = parseInt(req.params.groupId);

            let post = [];
            post = await Post.model.findMany({
                where: {
                    from: UploadPostWhere.GROUP,
                    groupId,
                    isApproved: false
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
                }
            })


            res.status(200).json(post)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    //------- GET POST --------//
    getPostGroup: async (req, res, next) => {
        try {
            const userFetchId = req.payload.aud;

            const groupId = parseInt(req.params.groupId);

            let post = [];
            post = await Post.model.findMany({
                where: {
                    from: UploadPostWhere.GROUP,
                    groupId
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
                }
            })


            res.status(200).json(post)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    //------- CREATE POST --------//
    createPost: async (req, res, next) => {
        try {
            const { content, files, folders } = req.body;
            let privacy = req.body.privacy || TypePrivacy.PUBLIC;
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
                const permission = await getPermissionGroup(ownerId, group.id)
                if (permission == GroupPermission.ADMIN) {
                    isApproved = true;
                } else if (group.approvalRequired) {
                    isApproved = false;
                }

                privacy = TypePrivacy.PRIVATE_GROUP
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

            let result = 'ok';
            for (const media of mediaOlds) {
                result = await deleteMediaFromCloudinary(media);
            }

            if (result !== 'ok') {
                return next(createError(500, "Error when delete media"))
            }

            if (mediaOlds) {
                const deletedOldMedia = await Post.deleteAllMedia(postId);

                if (!deletedOldMedia) {
                    return next(createError(500, "Error when delete media"))
                }
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
            const postId = parseInt(req.params.postId);
            const userId = parseInt(req.payload.aud);
            const conversationId = parseInt(req.params.conversationId);

            if (!postId) return next(createError(400, "Post not exist"))

            const post = await Post.model.findFirst({
                where: {
                    id: parseInt(postId),
                    isApproved: true
                }
            })

            if (!post) return next(createError(403, "Not access this post"))

            const type = TypeMessage.POST;

            const newMessage = new Message({
                conversationId,
                senderId: userId,
                type,
                postId
            })

            const messageSaved = await newMessage.save();

            await Conversation.model.update({
                where: {
                    id: parseInt(conversationId)
                },
                data: {
                    lastMessageAt: messageSaved.createdAt
                }
            })

            const messageRes = await prisma.message.update({
                where: {
                    id: messageSaved.id
                },
                data: {
                    seens: {
                        connect: {
                            id: userId
                        }
                    }
                },
                include: {
                    sender: {
                        include: {
                            userProfile: true
                        }
                    },
                    seens: {
                        include: {
                            userProfile: true
                        }
                    },
                    file: true,
                    folder: true,
                    post: {
                        include: {
                            owner: {
                                include: {
                                    userProfile: true
                                }
                            }
                        }
                    }
                },
            })

            res.status(200).json(messageRes);

        } catch (e) {
            console.log(e)
            next(createError(500, "Error when share post"))
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
    //------- GET REPLY --------//
    getReply: async (req, res, next) => {
        try {
            const { postId, commentId } = req.params;
            const groupId = req.params.groupId ? parseInt(req.params.groupId) : null;
            const userId = req.payload.aud;

            if (!postId) return next(createError(400, "Post not exist"))

            const post = await Post.model.findFirst({
                where: {
                    id: parseInt(postId),
                    isApproved: true
                }
            })

            if (!post) return next(createError(403, "Not access this post"))

            const reply = await prisma.comment.findMany({
                where: {
                    replyId: parseInt(commentId),
                    postId: parseInt(postId),
                },
                include: {
                    reply: true,
                    post: true,
                    replies: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                            userLikes: true,
                            replies: true,
                        }
                    },
                    userLikes: true,
                    user: {
                        include: {
                            userProfile: true
                        }
                    }
                }
            })

            const replyAccess = await Promise.all(
                reply.map(async (reply) => {
                    const relation = await getStateRelation(userId, reply.userId);
                    return !(relation.includes("BLOCKED") || relation.includes("BLOCKING")) ? reply : null;
                })
            );

            const filteredReplies = replyAccess.filter(reply => reply !== null);

            res.status(200).send(filteredReplies)
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when reply comment"))
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