const prisma = require("../services/prisma");

class Notify {
    static get model() {
        return prisma.notify
    }

    constructor({ message, link, type, read = false, userId }) {
        this.message = message;
        this.link = link;
        this.type = type;
        this.read = read;
        this.userId = userId;
    }

    async save() {
        return await prisma.notify.create({
            data: {
                link: this.link,
                type: this.type,
                message: this.message,
                read: this.read,
                userId: this.userId
            }
        })
    }
}

module.exports = Notify;