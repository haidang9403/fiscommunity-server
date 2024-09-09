const createError = require("http-errors");
const prisma = require("../services/prisma");
const bcrypt = require("bcrypt")
const { getInfoUser, getRequestProfileUser } = require("../utils/helper.util");
const { userSchema } = require("../utils/validation.util");

module.exports = {
    //--------- GET USER ----------//
    getUser: async (req, res, next) => {
        try {
            const userId = parseInt(req.params.userId);
            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                include: {
                    userProfile: true
                }
            });
            const userInfo = getInfoUser(user);

            // SUCCESSFULL
            res.status(200).json(userInfo);
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //----------- GET ALL USER ------------ //
    getAllUser: async (req, res, next) => {
        try {
            const allUsers = await prisma.user.findMany();

            res.status(200).json(allUsers);
        } catch (e) {
            console.error(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //--------- UPDATE PROFILE USER ----------- //
    updateProfile: async (req, res, next) => {
        try {
            const userId = parseInt(req.params.userId);
            const profileUser = getRequestProfileUser(req);
            const userProfileUpdated = await prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    userProfile: {
                        update: {
                            ...profileUser
                        }
                    }
                },
                include: {
                    userProfile: true
                }
            });

            res.status(200).json(userProfileUpdated.userProfile);
        } catch (e) {
            console.log(e);
            next(createError(500, "Internal Server Error"));
        }
    },
    //----------- CHANGE PASSWORD ---------- //
    changePassword: async (req, res, next) => {
        try {
            const { oldPassword, newPassword, confirmPassword } = req.body;
            const userId = parseInt(req.params.userId);

            // Validate
            await userSchema.changePassword.validate(
                { oldPassword, newPassword, confirmPassword },
                { context: { userId } }
            )

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({
                where: { id: userId },
                data: { password: hashedPassword }
            });

            res.status(200).json({ success: true, message: "Mật khẩu đã được thay đổi thành công" });
        } catch (e) {
            e.one = true;
            next(e);
        }
    }
}