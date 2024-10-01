const prisma = require("../services/prisma");
const { TypePrivacy, TypePost } = require("../enums");
const { UploadPostWhere } = require("@prisma/client");
const Media = require("./media.model");

class Post {
    static get model() {
        return prisma.post
    }

    constructor({
        id = null,
        content,
        like = 0,
        share = 0,
        comment = 0,
        type = TypePost.POST,
        privacy = TypePrivacy.PUBLIC,
        isApproved = true,
        from = UploadPostWhere.USER,
        ownerId,
        groupId,
        files = [],
        folders = [],
        userLikes = [],
        userShare = [],
        postShareId,
    }) {
        this.id = id ? parseInt(id) : null;
        this.content = content;
        this.like = parseInt(like);
        this.share = parseInt(share);
        this.comment = parseInt(comment);
        this.type = type ?? TypePost.POST;
        this.privacy = privacy;
        this.isApproved = isApproved;
        this.from = from;
        this.ownerId = parseInt(ownerId);
        this.groupId = groupId ? parseInt(groupId) : null;
        this.files = files;
        this.folders = folders;
        this.userLikes = userLikes;
        this.userShare = userShare;
        this.postShareId = postShareId ? parseInt(postShareId) : null;
    }

    async save() {
        let post;
        if (this.id) {
            // Cập nhật bài viết đã có
            const postExist = await prisma.post.findUnique({
                where: {
                    id: this.id
                }
            });

            const dataUpdated = {
                privacy: postExist.privacy,
                files: {
                    connect: this.files.map(fileId => ({ id: parseInt(fileId) }))
                },
                folders: {
                    connect: this.folders.map(folderId => ({ id: parseInt(folderId) }))
                }
            }

            if (this.content) {
                dataUpdated.content = this.content
            }

            if (this.privacy) {
                dataUpdated.privacy = this.privacy
            }

            post = await prisma.post.update({
                where: {
                    id: parseInt(this.id)
                },
                data: dataUpdated,
                include: {
                    media: true,
                    files: true,
                    folders: true,
                    postShare: true,
                }
            });
        } else {
            // Tạo mới bài viết
            const postData = {
                content: this.content,
                like: this.like,
                share: this.share,
                comment: this.comment,
                type: this.type,
                isApproved: this.isApproved,
                from: this.from,
                owner: {
                    connect: {
                        id: this.ownerId
                    }
                },
                files: {
                    connect: this.files.map(fileId => ({ id: parseInt(fileId) }))
                },
                folders: {
                    connect: this.folders.map(folderId => ({ id: parseInt(folderId) }))
                }
            };

            // Kiểm tra nếu có postShareId, thì thêm nó vào trong postData
            if (this.postShareId) {
                postData.postShare = {
                    connect: {
                        id: this.postShareId
                    }
                };
            }

            if (this.privacy) {
                postData.privacy = this.privacy
            }

            if (this.groupId) {
                postData.groupId = {
                    connect: {
                        id: this.groupId
                    }
                }
            }

            post = await prisma.post.create({
                data: postData,
                include: {
                    media: true,
                    group: true,
                    files: true,
                    folders: true,
                    postShare: true,
                }
            });
        }

        return post;
    }

    static async delete(id) {
        return await prisma.post.delete({
            where: {
                id: parseInt(id)
            },
            include: {
                media: true,
                comments: true,
            }
        })
    }

    static async deleteAllMedia(id) {
        const postId = parseInt(id);
        return await Media.model.deleteMany({
            where: {
                postId,
            }
        })
    }

    static async like({ postId, userId }) {
        const post = await prisma.post.findFirst({
            where: {
                id: parseInt(postId),
            },
            include: {
                userLikes: true
            }
        })

        if (post) {
            const userLiked = post.userLikes.some(user => parseInt(userId) == user.id)

            if (userLiked) {
                return await prisma.post.update({
                    where: {
                        id: parseInt(postId),
                    },
                    data: {
                        like: {
                            decrement: 1
                        },
                        userLikes: {
                            set: post.userLikes.filter(user => user.id !== parseInt(userId))
                        }
                    }
                })
            } else {
                return await prisma.post.update({
                    where: {
                        id: parseInt(postId),
                    },
                    data: {
                        like: {
                            increment: 1
                        },
                        userLikes: {
                            set: [...post.userLikes, { id: parseInt(userId) }]
                        }
                    }
                })
            }
        } else return null;
    }

    static async share({ postId, userId }) {
        const post = await prisma.post.findFirst({
            where: {
                id: parseInt(postId),
            },
            include: {
                userShare: true
            }
        })

        if (post) {
            // Share
            return await prisma.post.update({
                where: {
                    id: parseInt(postId),
                },
                data: {
                    share: {
                        increment: 1
                    },
                    userShare: {
                        connect: {
                            id: parseInt(userId)
                        }
                    }
                }
            })
        } else return null;
    }

    static async comment({ postId }) {
        return await prisma.post.update({
            where: {
                id: parseInt(postId),
            },
            data: {
                comment: {
                    increment: 1
                },
            }
        })
    }
}

module.exports = Post;