const { FriendRequestStatus } = require("@prisma/client");
const prisma = require("../../services/prisma");

class UserRelation {
    static get model() {
        return prisma.userRelation
    }

    constructor({ userSendId, userReciveId, isFriend = null, isFollow = null, isBlock = null, friendRequestStatus = null }) {
        this.userSendId = parseInt(userSendId);
        this.userReciveId = parseInt(userReciveId);
        this.isFriend = isFriend;
        this.isFollow = isFollow;
        this.isBlock = isBlock;
        this.friendRequestStatus = friendRequestStatus;
    }

    async save() {
        const existingRelation = await prisma.userRelation.findFirst({
            where: {
                userReciveId: this.userReciveId,
                userSendId: this.userSendId
            }
        })

        const isAddedFriend = await UserRelation.isAddedFriend(this.userSendId, this.userReciveId)

        // Nếu bản ghi đã tồn tại và không phải là bạn, thực hiện update
        if (existingRelation && !isAddedFriend) {
            // Unblock
            if (this.isBlock === false && existingRelation.isBlock === true) {
                await prisma.userRelation.deleteMany({
                    where: {
                        OR: [
                            {
                                userReciveId: this.userReciveId,
                                userSendId: this.userSendId
                            },
                            {
                                userReciveId: this.userSendId,
                                userSendId: this.userReciveId
                            }
                        ]
                    }
                })

                return true;
            }
            else {
                return await prisma.userRelation.update({
                    where: {
                        userSendId_userReciveId: {
                            userReciveId: this.userReciveId,
                            userSendId: this.userSendId
                        }
                    },
                    data: {
                        isFriend: this.isFriend ?? existingRelation.isFriend,
                        isFollow: this.isFollow ?? existingRelation.isFollow,
                        isBlock: this.isBlock ?? existingRelation.isBlock,
                        friendRequestStatus: this.friendRequestStatus ?? existingRelation.friendRequestStatus
                    }
                });
            }

        }
        // Nếu đã là bạn và muốn unfriend
        else if (isAddedFriend && this.friendRequestStatus === 'DELETED') {
            return await prisma.userRelation.updateMany({
                where: {
                    OR: [
                        {
                            userReciveId: this.userReciveId,
                            userSendId: this.userSendId
                        },
                        {
                            userReciveId: this.userSendId,
                            userSendId: this.userReciveId
                        }
                    ]
                },
                data: {
                    isFriend: this.isFriend,
                    friendRequestStatus: this.friendRequestStatus
                }
            })
        }
        // Nếu tồn tại bản ghi và muốn update
        else if (existingRelation) {
            return await prisma.userRelation.update({
                where: {
                    userSendId_userReciveId: {
                        userReciveId: this.userReciveId,
                        userSendId: this.userSendId
                    }
                },
                data: {
                    isFriend: this.isFriend ?? existingRelation.isFriend,
                    isFollow: this.isFollow ?? existingRelation.isFollow,
                    isBlock: this.isBlock ?? existingRelation.isBlock,
                    friendRequestStatus: this.friendRequestStatus ?? existingRelation.friendRequestStatus
                }
            });
        }
        // Nếu bản ghi chưa tồn tại thì tạo mới
        else if (!existingRelation) {
            return await prisma.userRelation.create({
                data: {
                    isFriend: this.isFriend ?? false,
                    isFollow: this.isFollow ?? false,
                    isBlock: this.isBlock ?? false,
                    friendRequestStatus: this.friendRequestStatus ?? "NONE",
                    userSend: {
                        connect: { id: this.userSendId } // This connects to an existing User record
                    },
                    userRecive: {
                        connect: { id: this.userReciveId } // This connects to an existing User record
                    }
                }
            });
        }
    }



    static async isAddedFriend(userSendId, userReciveId) {
        return await prisma.userRelation.findFirst({
            where: {
                OR: [
                    {
                        userReciveId: parseInt(userReciveId),
                        userSendId: parseInt(userSendId),
                        isFriend: true,
                        isBlock: false
                    },
                    {
                        userReciveId: parseInt(userSendId),
                        userSendId: parseInt(userReciveId),
                        isFriend: true,
                        isBlock: false
                    }
                ]
            }
        });
    }

    static async isPedding(userSendId, userReciveId) {
        return await prisma.userRelation.findFirst({
            where: {
                OR: [
                    {
                        userSendId: parseInt(userSendId),
                        userReciveId: parseInt(userReciveId),
                        friendRequestStatus: FriendRequestStatus.PENDING
                    },
                    {
                        userSendId: parseInt(userReciveId),
                        userReciveId: parseInt(userSendId),
                        friendRequestStatus: FriendRequestStatus.PENDING
                    }
                ]

            }
        });
    }

    static async isBlocked(userSendId, userReciveId) {
        return await prisma.userRelation.findFirst({
            where: {
                OR: [
                    {
                        userReciveId: parseInt(userReciveId),
                        userSendId: parseInt(userSendId),
                        isBlock: true
                    },
                    {
                        userReciveId: parseInt(userSendId),
                        userSendId: parseInt(userReciveId),
                        isBlock: true
                    }
                ]
            }
        });
    }

    static async isFriendorBlocked(userSendId, userReciveId) {
        return UserRelation.isAddedFriend(userSendId, userReciveId) ?? UserRelation.isBlocked(userSendId, userReciveId)
    }
}

module.exports = UserRelation;