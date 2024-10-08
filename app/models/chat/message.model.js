const { TypeMessage } = require("@prisma/client");
const prisma = require("../../services/prisma");

class Message {
    static get model() {
        return prisma.message;
    }

    constructor({ id, conversationId, senderId, body, url, type, fileId, folderId, postId }) {
        this.id = id ? parseInt(id) : null;
        this.conversationId = conversationId ? parseInt(conversationId) : null;
        this.senderId = senderId ? parseInt(senderId) : null;
        this.body = body;
        this.url = url;
        this.type = type; // "text", "file", "folder", etc.
        this.fileId = fileId ? parseInt(fileId) : null;
        this.folderId = folderId ? parseInt(folderId) : null;
        this.postId = postId ? parseInt(postId) : null;
    }

    // Tạo hoặc cập nhật tin nhắn
    async save() {
        let message;
        const dataUpdate = {};

        if (this.body) dataUpdate.body = this.body;
        if (this.type) dataUpdate.type = this.type;
        if (this.url) dataUpdate.url = this.url;

        switch (this.type) {
            case TypeMessage.FILE:
                if (!this.fileId) throw new Error("File id is invalid")

                var fileExists = await prisma.file.findUnique({
                    where: { id: this.fileId },
                });

                if (!fileExists) throw new Error("File does not exist");

                dataUpdate.file = {
                    connect: {
                        id: this.fileId
                    }
                }
                break;
            case TypeMessage.FOLDER:
                if (!this.folderId) throw Error("Folder id is invalid")

                var folderExists = await prisma.folder.findUnique({
                    where: { id: this.folderId },
                });

                if (!folderExists) throw new Error("Folder does not exist");
                dataUpdate.folder = {
                    connect: {
                        id: this.folderId
                    }
                }
                break;
            case TypeMessage.POST:
                if (!this.folderId) throw Error("Post id is invalid")

                var postExsits = await prisma.post.findUnique({
                    where: { id: this.folderId },
                });

                if (!postExsits) throw new Error("Post does not exist");

                dataUpdate.post = {
                    connect: {
                        id: this.postId
                    }
                }
                break;
        }

        if (this.id) {
            message = await prisma.message.update({
                where: { id: this.id },
                data: dataUpdate,
            });
        } else {
            message = await prisma.message.create({
                data: {
                    ...dataUpdate,
                    sender: {
                        connect: {
                            id: this.senderId
                        }
                    },
                    conversation: {
                        connect: {
                            id: this.conversationId
                        }
                    },
                },
            });
        }

        return message;
    }

    // Tìm tin nhắn theo cuộc trò chuyện
    static async findMessagesByConversation(conversationId) {
        const messages = await prisma.message.findMany({
            where: { conversationId: parseInt(conversationId) },
            orderBy: { createdAt: "asc" }
        });

        return messages;
    }

    // Xóa tin nhắn
    static async deleteMessage(messageId) {
        return await prisma.message.update({
            where: { id: parseInt(messageId) },
            data: {
                deleted: true
            }
        });
    }
}

module.exports = Message;
