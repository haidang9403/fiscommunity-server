const JWT = require("jsonwebtoken");
const config = require("../config");
const createError = require("http-errors");
const prisma = require("../services/prisma");
const bcrypt = require("bcrypt");


module.exports = {
    // CREATE ACCESSTOKEN
    signAccessToken: (userId) => {
        return new Promise((resolve, reject) => {
            const payload = {
                aud: userId,
            }

            const secret = config.jwt.access_key;
            const options = {
                expiresIn: '15m'
            }

            JWT.sign(payload, secret, options, (err, token) => {
                if (err) return reject(err)
                resolve(token)
            })
        })
    },
    // CREATE REFRESHTOKEN
    signRefreshToken: (userId) => {
        return new Promise((resolve, reject) => {
            const payload = {
                aud: userId,
            }

            const secret = config.jwt.refresh_key;

            const options = {
                expiresIn: "1y"
            }

            JWT.sign(payload, secret, options, (err, token) => {
                if (err) return reject(err)
                resolve(token)
            })
        })
    },
    // VERIFY ACCESSTOKEN
    verifyAccessToken: (req, res, next) => {
        if (!req.headers['authorization']) return next(createError(401, "Unauthorized"));
        const token = req.headers['authorization'].split(" ")[1]
        JWT.verify(token, config.jwt.access_key, (err, payload) => {
            if (err) return next(createError(401, err.message));
            req.payload = payload;
            next()
        })
    },
    // VERIFY REFRESHTOKEN
    verifyRefreshToken: (req, res, next) => {
        const token = req.cookies.refreshToken;
        JWT.verify(token, config.jwt.refresh_key, async (err, payload) => {
            if (err) return next(createError(401, err.message));
            const result = await prisma.user.findUnique({
                select: {
                    refreshToken: true
                },
                where: {
                    id: payload.aud
                }
            });

            const isAuthRefreshToken = await bcrypt.compare(token, result.refreshToken);

            if (isAuthRefreshToken) {
                req.payload = payload;
                next()
            }
            else {
                next(createError(401, "Invalid refreshToken"))
            }

        })
    },
    verifyToken: (token) => {
        let user_id;
        JWT.verify(token, config.jwt.refresh_key, (err, payload) => {
            if (err) throw createError(401, err.message)
            user_id = payload.aud;
        })

        return user_id
    },
}