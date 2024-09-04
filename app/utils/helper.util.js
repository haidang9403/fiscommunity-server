const JWT = require("./jwt.util");
const bcrypt = require("bcrypt");
const prisma = require("../services/prisma")

const getInfoUser = (user) => {
    return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        totalStorage: user.totalStorage,
        limitStorage: user.limitStorage,
        userProfile: user.userProfile,
    }
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

module.exports = {
    getInfoUser,
    signToken
}