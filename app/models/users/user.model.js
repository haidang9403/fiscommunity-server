const prisma = require("../../services/prisma");

class User {
    static get model() {
        return prisma.user
    }

    constructor({
        id = null,
        email,
        password,
        phone = null,
        totalStorage,
        limitStorage
    }) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.phone = phone;
        this.totalStorage = totalStorage;
        this.limitStorage = limitStorage;
    }

    static async isValidUser(id) {
        return await prisma.user.findUnique({
            where: {
                id: parseInt(id)
            }
        })
    }
}

module.exports = User;