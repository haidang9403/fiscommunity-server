const prisma = require("../../services/prisma");

class UserProfile {
    static get model() {
        return prisma.userProfile
    }

    constructor({
        id = null,
        fullname,
        address,
        birthday,
        bio,
        avatar,
        gender,
    }) {
        this.id = id;
        this.fullname = fullname;
        this.address = address;
        this.birthday = birthday;
        this.bio = bio;
        this.avatar = avatar;
        this.gender = gender;
    }
}

module.exports = UserProfile;