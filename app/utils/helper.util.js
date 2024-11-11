const JWT = require("./jwt.util");
const bcrypt = require("bcrypt");
const prisma = require("../services/prisma");
const { FriendRequestStatus, GroupPermission, StateAttendGroup } = require("@prisma/client");
const { parse } = require("dotenv");

const getInfoUser = (user) => {
    return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        totalStorage: user.totalStorage.toString(),
        limitStorage: user.limitStorage.toString(),
        userProfile: user.userProfile,
    }
}

const getRequestProfileUser = (req) => {
    const allowdFields = ["fullname", "address", "birthday", "bio", "gender"];
    const profile = {};

    allowdFields.forEach((field) => {
        if (req.body[field]) {
            if (field == "birthday") {
                profile[field] = new Date(req.body[field]);
            } else if (field == "gender") {
                profile[field] = parseInt(req.body[field]);
            } else {
                profile[field] = req.body[field];
            }
        }
    })

    return profile;
}

const signToken = async (userId, res) => {
    const accessToken = await JWT.signAccessToken(userId);
    const refreshToken = await JWT.signRefreshToken(userId);

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        path: "/",
        sameSite: "strict",
    });

    const salt = await bcrypt.genSalt(10);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);

    await prisma.user.update({
        where: {
            id: userId
        },
        data: {
            refreshToken: hashedRefreshToken
        }
    })

    return {
        accessToken,
        refreshToken
    }
}

// Utility to remove null or undefined fields from data
function cleanData(data) {
    return Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v != null)
    );
}

const getStateRelation = async (userCurrentId, userTargetId) => {
    try {
        if (userCurrentId == userTargetId) return ["OWN"]
        const relation = await prisma.userRelation.findFirst({
            where: {
                userSendId: parseInt(userCurrentId),
                userReciveId: parseInt(userTargetId)
            }
        })

        let relations = []

        if (relation) {
            if (relation.isBlock) {
                return ["BLOCKING"]
            }

            if (relation.isFriend) {
                relations.push("FRIEND")
            }

            if (relation.friendRequestStatus == FriendRequestStatus.PENDING && !relation.isFriend) {
                relations.push("PENDING")
            }

            if (relation.isFollow) {
                relations.push("FOLLOWING")
            }
        }

        const relationReverse = await prisma.userRelation.findFirst({
            where: {
                userSendId: parseInt(userTargetId),
                userReciveId: parseInt(userCurrentId)
            }
        })

        if (relationReverse) {
            if (relationReverse.isBlock) {
                return ["BLOCKED"]
            }

            if (relationReverse.isFriend) {
                if (!relations.includes("FRIEND")) {
                    relations.push("FRIEND")
                }
            }

            if (relationReverse.friendRequestStatus == FriendRequestStatus.PENDING && !relationReverse.isFriend) {
                relations.push("WAITING")
            }

            if (relationReverse.isFollow) {
                relations.push("FOLLOWED")
            }
        }

        if (relations.length == 0) {
            relations.push("NONE")
        }

        return relations
    } catch (e) {
        console.log(e)
    }
}

const getPermissionGroup = async (userId, groupId) => {
    const group = await prisma.group.findUnique({
        where: {
            id: parseInt(groupId)
        },
        include: {
            users: {
                include: {
                    user: true
                }
            }
        }
    })

    const userInGroup = group.users.find(userGroup => userGroup.user.id == userId)

    const permission = userInGroup?.permission;

    return permission || GroupPermission.NONE
}

const getStateInGroup = async (userId, groupId) => {
    const group = await prisma.group.findUnique({
        where: {
            id: parseInt(groupId)
        },
        include: {
            users: {
                include: {
                    user: true
                }
            }
        }
    })

    const userInGroup = group.users.find(userGroup => userGroup.user.id == userId)

    const state = userInGroup?.state;

    return state || StateAttendGroup.NONE
}

module.exports = {
    getInfoUser,
    signToken,
    getRequestProfileUser,
    cleanData,
    getStateRelation,
    getPermissionGroup,
    getStateInGroup
}