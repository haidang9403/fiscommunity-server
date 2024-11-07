const prisma = require("../services/prisma");

class Comment {
    static get model() {
        return prisma.comment
    }

    constructor({
        id,
        content,
        url,
        like,
        postId,
        userId,
        replyId
    }) {
        this.id = id ? parseInt(id) : null;
        this.content = content ?? "";
        this.url = url ?? null;
        this.like = like ?? 0;
        this.postId = parseInt(postId);
        this.userId = parseInt(userId);
        this.replyId = replyId ? parseInt(replyId) : null;
    }

    async save() {
        let post;

        console.log(this.id)

        if (this.id) {
            post = await prisma.comment.update({
                where: {
                    id: this.id,
                },
                data: {
                    content: this.content,
                    url: this.url,
                },
                include: {
                    user: true,
                    reply: true,
                    post: true,
                }
            })

        } else {
            const commentData = {
                content: this.content,
                url: this.url,
                like: this.like,
                user: {
                    connect: {
                        id: this.userId
                    }
                },
                post: {
                    connect: {
                        id: this.postId
                    }
                }
            }

            if (this.replyId) {
                commentData.reply = {
                    connect: {
                        id: this.replyId
                    }
                }
            }

            post = await prisma.comment.create({
                data: commentData,
                include: {
                    reply: true,
                    post: true,
                    replies: true,
                    userLikes: true,
                    user: {
                        include: {
                            userProfile: true
                        }
                    }
                }
            })
        }

        return post;
    }

    static async like({ commentId, userId }) {
        const comment = await prisma.comment.findFirst({
            where: {
                id: parseInt(commentId),
            },
            include: {
                userLikes: true
            }
        })

        if (comment) {
            const userLiked = comment.userLikes.some(user => parseInt(userId) == user.id)

            if (userLiked) {
                await prisma.comment.update({
                    where: {
                        id: parseInt(commentId),
                    },
                    data: {
                        like: {
                            decrement: 1
                        },
                        userLikes: {
                            disconnect: {
                                id: parseInt(userId)
                            }
                        }
                    }
                })
            } else {
                await prisma.comment.update({
                    where: {
                        id: parseInt(commentId),
                    },
                    data: {
                        like: {
                            increment: 1
                        },
                        userLikes: {
                            connect: {
                                id: parseInt(userId)
                            }
                        }
                    }
                })
            }

            return !userLiked;
        } else return null;
    }
}

module.exports = Comment;