const prisma = require("../services/prisma");

class Notify {
    static get model() {
        return prisma.notify
    }

    constructor({ message, link, type, read, userId, userSendId, groupSendId }) {
        this.message = message;
        this.link = link ?? ""; // Link lay tu client
        this.type = type;
        this.read = read ?? false;
        this.userId = parseInt(userId);
        this.userSendId = parseInt(userSendId);
        this.groupSendId = groupSendId ? parseInt(groupSendId) : null;
    }

    async save() {
        const dataNotify = {
            data: {
                link: this.link,
                type: this.type,
                message: this.message,
                read: this.read,
                user: {
                    connect: {
                        id: this.userId
                    }
                },
                userSend: {
                    connect: {
                        id: this.userSendId
                    }
                }
            }
        }

        if (this.groupSendId) {
            dataNotify.groupSend = {
                connect: {
                    id: this.groupSendId
                }
            }
        }
        return await prisma.notify.create({
            data: dataNotify
        })
    }
}

module.exports = Notify;