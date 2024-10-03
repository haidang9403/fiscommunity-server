const { StateAttendGroup } = require("@prisma/client")
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

        const isExist = await prisma.userAttendGroup.findFirst({
            where: {
                groupId: this.groupId,
                userId: this.userId
            }
        })

        if (isExist) {
            return await prisma.userAttendGroup.update({
                where: {
                    groupId_userId: {
                        groupId: this.groupId,
                        userId: this.userId
                    }
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

    static async isPendding({ groupId, userId }) {
        return prisma.userAttendGroup.findFirst({
            where: {
                groupId: parseInt(groupId),
                userId: parseInt(userId),
                state: StateAttendGroup.PENDING
            }
        })
    }
}

module.exports = UserAttendGroup