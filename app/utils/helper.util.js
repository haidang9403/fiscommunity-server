const JWT = require("./jwt.util");
const bcrypt = require("bcrypt");
const prisma = require("../services/prisma")

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
            profile[field] = req.body[field];
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

module.exports = {
    getInfoUser,
    signToken,
    getRequestProfileUser,
    cleanData
}