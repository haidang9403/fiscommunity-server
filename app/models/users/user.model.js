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
        limitStorage,
        userProfileId
    }) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.phone = phone;
        this.totalStorage = totalStorage;
        this.limitStorage = limitStorage;
        this.userProfileId = parseInt(userProfileId);
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