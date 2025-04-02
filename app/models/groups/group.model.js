const prisma = require("../../services/prisma");

class Group {
    static get model() {
        return prisma.group;
    }

    constructor({
        id,
        groupName,
        bio,
        avatar,
        type,
        approvalRequired,
        totalStorage = 0,
        limitStorage = 3221225472,
        ownerId,
    }) {
        this.id = id ? parseInt(id) : null;
        this.groupName = groupName;
        this.bio = bio;
        this.avatar = avatar;
        this.type = type;
        this.approvalRequired = approvalRequired;
        this.totalStorage = totalStorage;
        this.limitStorage = limitStorage;
        this.ownerId = parseInt(ownerId);
    }

    async save() {
        const data = {
            groupName: this.groupName,
            bio: this.bio,
            avatar: this.avatar,
            totalStorage: this.totalStorage !== 0 && this.totalStorage <= this.limitStorage
                ? parseFloat(this.totalStorage)
                : undefined,
            approvalRequired: this.approvalRequired,
            type: this.type,
        };

        if (this.id) {
            return await prisma.group.update({
                where: { id: this.id },
                data: this._cleanData(data),
            });
        } else {
            return await prisma.group.create({
                data: {
                    ...this._cleanData(data),
                    limitStorage: parseFloat(this.limitStorage),
                    owner: { connect: { id: this.ownerId } },
                },
            });
        }
    }

    static async isOwner({ groupId, userId }) {
        const { ownerId } = await prisma.group.findUnique({
            where: {
                id: parseInt(groupId)
            }
        })

        return ownerId == userId
    }

    // Utility to remove null or undefined fields from data
    _cleanData(data) {
        return Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v != null)
        );
    }
}

module.exports = Group;