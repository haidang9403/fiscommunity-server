const createError = require("http-errors");
const config = require("../config");
const prisma = require("../services/prisma");
const axios = require("axios");
const { getFileFromGCS } = require("../utils/googleCloundStorage/get.util");
const JWT = require("jsonwebtoken");
const bucket = require("../services/googleCloudStorage");

const fileTypes = [
    "csv", "djvu", "doc", "docm", "docx", "docxf", "dot", "dotm", "dotx",
    "epub", "fb2", "fodp", "fods", "fodt", "htm", "html", "hwp", "hwpx",
    "key", "mht", "numbers", "odp", "ods", "odt", "oform", "otp", "ots",
    "ott", "oxps", "pages", "pdf", "pot", "potm", "potx", "pps", "ppsm",
    "ppsx", "ppt", "pptm", "pptx", "rtf", "txt", "xls", "xlsb", "xlsm",
    "xlsx", "xlt", "xltm", "xltx", "xml", "xps"
];


const editController = {
    getConfig: async (req, res, next) => {
        try {
            const { fileId } = req.query;
            const userId = req.payload.aud

            const file = await prisma.file.findUnique({
                where: {
                    id: parseInt(fileId)
                },
                include: {
                    announcements: true,
                    taskAttachments: true,
                    taskSubmissions: {
                        include: {
                            assignedUsers: true,
                        }
                    },
                    userTaskSubmissions: true
                }
            })

            if (!file) return next(createError(404, "File not found"))

            if (!fileTypes.includes(file.title.split(".").slice(-1)[0])) {
                const pathFileArray = file.url.split("/");
                pathFileArray.shift();
                const pathFile = pathFileArray.join("/");

                await getFileFromGCS(pathFile, async (error, result) => {
                    if (error) return next(createError(500, "Error when get file"));

                    return res.status(200).json({
                        isNotOpen: true,
                        title: file.title,
                        url: result.url,
                    })
                })
            }

            const user = await prisma.user.findUnique({
                where: {
                    id: parseInt(userId)
                },
                include: {
                    userProfile: true
                }
            })

            let mode = "view";

            if (file.from == "USER") {
                if (file.ownerId == user.id) {
                    mode = "edit"
                } else {
                    mode = "view"
                }
            } else if (file.from == "WORKSPACE") {
                if (file.taskAttachments.length > 0) {
                    const conversation = await prisma.conversation.findFirst({
                        where: {
                            workspaces: {
                                some: {
                                    id: file.taskAttachments[0].workspaceId
                                }
                            }
                        },
                        include: {
                            admins: true
                        }
                    })

                    if (conversation.admins.map(user => user.id).includes(user.id)) {
                        mode = "edit"
                    } else {
                        mode = "view"
                    }
                } else if (file.taskSubmissions.length > 0) {
                    if (file.taskSubmissions[0].assignedUsers.map(user => user.userId).includes(user.id)) {
                        mode = "edit"
                    } else {
                        return next(createError(403))
                    }
                } else if (file.userTaskSubmissions.length > 0) {
                    if (file.userTaskSubmissions[0].userId == user.id) {
                        mode = "edit"
                    } else {
                        mode = "view"
                    }
                } else if (file.announcements.length > 0) {
                    const conversation = await prisma.conversation.findFirst({
                        where: {
                            workspaces: {
                                some: {
                                    id: file.announcements[0].workspaceId
                                }
                            }
                        },
                        include: {
                            admins: true
                        }
                    })

                    if (conversation.admins.map(user => user.id).includes(user.id)) {
                        mode = "edit"
                    } else {
                        mode = "view"
                    }
                } else {
                    return next(createError(400))
                }
            }

            const pathFileArray = file.url.split("/");
            pathFileArray.shift();
            const pathFile = pathFileArray.join("/");

            const publicUrl = await new Promise((resolve, reject) => {
                getFileFromGCS(pathFile, async (error, result) => {
                    console.log(error)
                    if (error) reject(createError(500, "Can't get file"))

                    resolve(result.url)
                })
            })

            const payload = {
                document: {
                    fileType: file.title.split(".").slice(-1)[0],
                    key: file.id.toString(),
                    title: file.title,
                    url: publicUrl
                },
                editorConfig: {
                    mode,
                    callbackUrl: config.onlyOffice.callback_url_edit,
                    user: {
                        id: user.id.toString(),
                        name: user.userProfile.fullname
                    },
                    customization: {
                        chat: true,
                        comments: true,
                        uiTheme: "theme-light",
                        unit: "cm",
                        close: {
                            visible: true,
                            text: "Close file",
                        },
                    },
                }
            }

            const secret = config.onlyOffice.secret_key;
            const options = {
                expiresIn: '30m'
            }

            const token = await new Promise((resolve, reject) => {
                JWT.sign(payload, secret, options, (err, token) => {
                    if (err) return reject(err)
                    resolve(token)
                })
            })

            const configRes = {
                "document": {
                    "fileType": file.title.split(".").slice(-1)[0],
                    "key": file.id.toString(),
                    "title": file.title,
                    "url": publicUrl
                },
                "token": token,
                "editorConfig": {
                    "mode": mode,
                    "callbackUrl": config.onlyOffice.callback_url_edit,
                    "user": {
                        "id": user.id.toString() || "guest",
                        "name": user.userProfile.fullname || "Guest User"
                    },
                    "customization": {
                        "chat": true, // Bật chat giữa các người dùng trong tài liệu
                        "comments": true, // Bật comment
                        "uiTheme": "theme-light",
                        "unit": "cm",
                        "close": {
                            "visible": true,
                            "text": "Close file",
                        },
                    },
                },

            };

            res.json(configRes);
        } catch (error) {
            console.log(error)
            next(createError(500))
        }

    },
    saveFile: async (req, res, next) => {
        try {
            const { status, url, key } = req.body;

            // Chỉ xử lý nếu tài liệu đã chỉnh sửa xong (status = 2)
            if (status !== 2 || !url) {
                return res.status(200).json({ "error": 0 });
            }

            // Tìm file trong database
            const file = await prisma.file.findUnique({
                where: { id: parseInt(key) }
            });

            if (!file) return next(createError(404, "File not found"));

            const response = await axios.get(url, { responseType: "stream" });

            // Lưu file lên GCS
            const filePath = file.url.split("/")
            filePath.shift()
            const gcsFile = bucket.file(filePath.join("/"));

            const writeStream = gcsFile.createWriteStream();
            response.data.pipe(writeStream);

            writeStream.on("finish", async () => {

                // Cập nhật lại URL trong database
                const [metadata] = await gcsFile.getMetadata();
                const fileSize = (metadata.size / (1024 * 1024)).toFixed(4);

                await prisma.file.update({
                    where: { id: file.id },
                    data: { size: Number(fileSize) }
                });

                return res.status(200).json({ "error": 0 });
            });

            writeStream.on("error", (err) => {
                console.error("Error saving file to GCS:", err);
                next(createError(500, "Error saving file"));
            });


        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    }
}

module.exports = editController