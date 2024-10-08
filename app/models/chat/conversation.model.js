const prisma = require("../../services/prisma");

class Conversation {
    static get model() {
        return prisma.conversation;
    }

    constructor({ id, name, isGroup, userIds, lastMessageAt, totalStorage, limitStorage, adminIds }) {
        this.id = id ? parseInt(id) : null;
        this.name = name ?? "";
        this.isGroup = isGroup ?? false;
        this.userIds = userIds?.map(userId => parseInt(userId)) || [];
        this.lastMessageAt = lastMessageAt;
        this.totalStorage = totalStorage ?? 0;
        this.limitStorage = limitStorage ?? 5000;
        this.adminIds = adminIds?.map(adminId => parseInt(adminId)) || [];
    }

    // Kiểm tra cuộc trò chuyện đã tồn tại giữa hai người
    static async findConversationBetweenUsers(userId1, userId2) {
        const existingConversation = await prisma.conversation.findFirst({
            where: {
                isGroup: false,
                AND: [
                    {
                        user: {
                            some: { id: userId1 }
                        }
                    },
                    {
                        user: {
                            some: { id: userId2 }
                        }
                    }
                ]
            }
        });

        if (existingConversation) {
            return {
                ...existingConversation,
                totalStorage: existingConversation.totalStorage.toString(),
                limitStorage: existingConversation.limitStorage.toString()
            };
        } else return null;
    }


    // Tạo hoặc cập nhật cuộc trò chuyện
    async save() {
        let conversation;

        if (this.id) {
            const dataUpdate = {}

            if (this.name != "") dataUpdate.name = this.name
            if (this.totalStorage != 0) dataUpdate.totalStorage = this.totalStorage
            if (this.limitStorage != 5000) dataUpdate.limitStorage = this.limitStorage
            if (this.lastMessageAt) dataUpdate.lastMessageAt = this.lastMessageAt

            conversation = await prisma.conversation.update({
                where: {
                    id: this.id,
                },
                data: dataUpdate,
                include: {
                    user: true
                }
            });
        } else {
            conversation = await prisma.conversation.create({
                data: {
                    name: this.name,
                    isGroup: this.isGroup,
                    totalStorage: parseFloat(this.totalStorage),
                    limitStorage: parseFloat(this.limitStorage),
                    user: {
                        connect: this.userIds.map(userId => ({ id: userId }))
                    },
                    admins: {
                        connect: this.adminIds.map(adminId => ({ id: adminId }))
                    }
                },
                include: {
                    user: true,
                },
            });
        }

        const modifiedUsers = conversation.user.map(({ totalStorage, limitStorage, ...userWithoutStorage }) => userWithoutStorage);

        return {
            ...conversation,
            totalStorage: conversation.totalStorage.toString(),
            limitStorage: conversation.limitStorage.toString(),
            user: modifiedUsers
        };
    }

    // Tạo nhóm chat mới
    static async createGroup({ name, userIds, adminIds }) {
        if (!name) {
            const adminUser = await prisma.user.findUnique({
                where: {
                    id: parseInt(adminIds[0])
                },
                include: {
                    userProfile: true
                }
            })

            name = "Nhóm của " + adminUser.userProfile.fullname
        }

        const conversation = new Conversation({
            name,
            isGroup: true,
            userIds,
            adminIds
        });

        return await conversation.save();
    }

    // Thêm thành viên vào nhóm chat
    static async addMembers(conversationId, userIds) {
        const conversation = await prisma.conversation.update({
            where: { id: parseInt(conversationId) },
            data: {
                user: {
                    connect: userIds.map(userId => ({ id: parseInt(userId) }))
                }
            },
            include: {
                user: true
            }
        });

        return conversation;
    }

    // Thêm quản trị viên nhóm chat
    static async addAdmin(conversationId, adminIds) {
        const conversation = await prisma.conversation.update({
            where: { id: parseInt(conversationId) },
            data: {
                admins: {
                    connect: adminIds.map(adminId => ({ id: parseInt(adminId) }))
                }
            },
            include: {
                user: true
            }
        });

        return conversation;
    }

    // Xóa thành viên nhóm chat
    static async removeMember(conversationId, userIds) {
        const conversation = await prisma.conversation.update({
            where: { id: parseInt(conversationId) },
            data: {
                user: {
                    disconnect: userIds.map(userId => ({ id: parseInt(userId) }))
                },
                admins: {
                    disconnect: userIds.map(userId => ({ id: parseInt(userId) }))
                }
            },
            include: {
                user: true,
                admins: true
            }
        });

        return conversation;
    }

    // Tìm và cập nhật thông tin cuộc trò chuyện
    static async updateConversation(conversationId, data) {
        const dataUpdate = {};
        if (data.name) dataUpdate.name = data.name
        if (data.totalStorage) dataUpdate.totalStorage = data.totalStorage
        if (data.limitStorage) dataUpdate.limitStorage = data.limitStorage
        if (data.lastMessageAt) dataUpdate.lastMessageAt = data.lastMessageAt

        const conversationNotGroup = await prisma.conversation.findUnique({
            where: {
                id: parseInt(conversationId),
            }
        })

        if (conversationNotGroup) dataUpdate.name = ""

        const updatedConversation = await prisma.conversation.update({
            where: {
                id: parseInt(conversationId),
            },
            data: dataUpdate,
        });

        return {
            ...updatedConversation,
            totalStorage: updatedConversation.totalStorage.toString(),
            limitStorage: updatedConversation.limitStorage.toString()
        };
    }
}

module.exports = Conversation;
