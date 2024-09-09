const createError = require("http-errors");
const { authSchema } = require("../utils/validation.util");
const prisma = require("../services/prisma");
const bcrypt = require("bcrypt");
const JWT = require("../utils/jwt.util");
const { getInfoUser, signToken } = require("../utils/helper.util")

const authController = {
    // ------------ LOGIN ---------------//
    login: async (req, res, next) => {
        try {
            const loginUser = await authSchema.login.validate(req.body);

            // FIND USER IN DATABASE
            const existUser = await prisma.user.findUnique({
                where: {
                    email: loginUser.email,
                },
                include: {
                    userProfile: true
                }
            })

            if (!existUser) {
                return res.status(404).json({ email: "Tài khoản không tồn tại" });
            }

            const isValidPassword = await bcrypt.compare(loginUser.password, existUser.password);
            if (!isValidPassword) {
                return res.status(400).json({ password: "Mật khẩu không chính xác" });
            }

            const { accessToken } = await signToken(existUser.id, res);

            const infoUser = getInfoUser(existUser);

            // LOGIN SUCCESSFULL
            res.status(200).send({ ...infoUser, accessToken });
        } catch (e) {
            e.one = true;
            return next(e);
        }
    },
    // ---------------- REGISTER ----------------- //
    register: async (req, res, next) => {
        try {
            const registerUser = await authSchema.register.validate(req.body, { abortEarly: false });

            // FIND USER IN DATABASE
            const existUser = await prisma.user.findUnique({
                where: {
                    email: registerUser.email,
                }
            });

            if (existUser) {
                return res.status(400).send({ username: "Tài khoản đã tồn tại trên hệ thống" });
            }

            // HASH PASSWORD
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(registerUser.password, salt);

            // CREATE NEW USER
            const newUser = await prisma.user.create({
                data: {
                    email: registerUser.email,
                    password: hashedPassword,
                    userProfile: {
                        create: {
                            fullname: registerUser.fullname,
                            birthday: registerUser.birthday,
                            gender: registerUser.gender,
                        }
                    }
                },
                include: {
                    userProfile: true
                }
            })

            const { accessToken } = await signToken(newUser.id, res);

            const infoUser = getInfoUser(newUser);

            // SIGN UP SUCCESSFULL!
            return res.send({ ...infoUser, accessToken });
        } catch (e) {
            e.all = true;
            return next(e);
        }
    },
    // REFRESH TOKEN
    refreshToken: async (req, res, next) => {
        try {
            const oldRefreshToken = req.cookies.refreshToken;
            if (!oldRefreshToken) throw createError(400, "Refresh Token is not valid");
            const userId = await JWT.verifyToken(oldRefreshToken);

            const { accessToken } = await signToken(userId, res);

            return res.send({ accessToken })
        } catch (e) {
            return next(e);
        }
    },
    // LOGOUT
    logout: async (req, res) => {
        res.clearCookie("refreshToken");
        res.send({ success: true, message: "Đăng xuất thành công" })
    },
}

module.exports = authController;