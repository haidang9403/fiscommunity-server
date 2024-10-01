const prisma = require("../../services/prisma")
const { cleanData } = require("../../utils/helper.util")

class UserAttendGroup {
    static model() {
        return prisma.userAttendGroup
    }

    constructor({
        groupId,
        userId,
        state,
        permission
    }) {
        this.groupId = parseInt(groupId)
        this.userId = parseInt(userId)
        this.state = state
        this.permission = permission
    }

    async save() {
        const data = {
            state: this.state,
            permission: this.permission
        };

        if (this.id) {
            return await prisma.userAttendGroup.update({
                where: {
                    groupId: this.groupId,
                    userId: this.userId
                },
                data: cleanData(data)
            })
        } else {
            return await prisma.userAttendGroup.create({
                data: {
                    ...cleanData(data),
                    group: {
                        connect: {
                            id: this.groupId
                        }
                    },
                    user: {
                        connect: {
                            id: this.userId
                        }
                    }
                }
            });
        }
    }
}

module.exports = UserAttendGroup