const prisma = require("../services/prisma");
const { TypePrivacy, TypePost } = require("../enums")

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
        ofGroup = false,
        type,
        privacy = TypePrivacy.PUBLIC,
        ownerId,
        files = [],
        folders = [],
        userLikes = [],
        userShare = [],
        postShareId,
    }) {
        this.id = id;
        this.content = content;
        this.like = parseInt(like);
        this.share = parseInt(share);
        this.comment = parseInt(comment);
        this.ofGroup = ofGroup;
        this.type = type ?? TypePost.POST;
        this.privacy = privacy ?? TypePrivacy.PUBLIC;
        this.ownerId = parseInt(ownerId);
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
            post = await prisma.post.update({
                where: {
                    id: parseInt(this.id)
                },
                data: {
                    content: this.content,
                    privacy: this.privacy
                },
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
                ofGroup: this.ofGroup,
                type: this.type,
                privacy: this.privacy,
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

            post = await prisma.post.create({
                data: postData,
                include: {
                    media: true,
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