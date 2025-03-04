const createError = require("http-errors");
const prisma = require("../services/prisma");
const { uploadFilesToGCS, uploadFileToGCS } = require("../utils/googleCloundStorage/upload.util");
const { UploadDocumentWhere, TypePrivacy, PermissionOnTask, ActionTask, StatusTask } = require("@prisma/client");
const { deleteFilesFromGCS, deleteFileFromGCS } = require("../utils/googleCloundStorage/delete.util");
const { logTaskHistory } = require("../utils/logTaskHistory.util");

const taskController = {
    // Get list task
    getList: async (req, res, next) => {
        try {
            const { workspaceId, conversationId } = req.params;
            const { isNotification, status } = req.query;
            const userId = req.payload.aud;

            const conversation = await prisma.conversation.findUnique({
                where: {
                    id: parseInt(conversationId),
                },
                include: {
                    admins: true
                }
            })

            const isAdmin = conversation.admins.findIndex((admin) => admin.id == parseInt(userId))

            let result = []

            if (isNotification) {
                result = await prisma.announcement.findMany({
                    where: {
                        workspaceId: parseInt(workspaceId),
                    },
                    include: {
                        files: true
                    },
                    orderBy: {
                        createdAt: "desc"
                    }
                })
            } else {
                let where = {
                    workspaceId: parseInt(workspaceId),
                    status,
                }

                if (isAdmin == -1) {
                    where.assignedUsers = {
                        some: {
                            userId: parseInt(userId)
                        }
                    }
                }

                result = await prisma.task.findMany({
                    where,
                    include: {
                        assignedUsers: {
                            include: {
                                user: {
                                    include: {
                                        userProfile: true
                                    }
                                },
                            }
                        },
                        fileSubmissions: true,
                        fileAttachments: true,
                        workspace: true
                    },
                    orderBy: {
                        createdAt: "desc"
                    }
                })
            }

            res.status(200).json(result)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // Create task
    createTask: async (req, res, next) => {
        try {
            const { workspaceId, conversationId } = req.params;
            const { title, description, userIds } = req.body;
            let deadline = req.body.deadline;

            const files = req.files;
            const userId = req.payload.aud;

            let userIdsArray = userIds

            if (!Array.isArray(userIdsArray)) userIdsArray = [userIdsArray].filter(Boolean)


            if (!title || !description) return next(createError(400, "Missing title or desciption"))

            if (deadline == "null") deadline = null

            const data = {
                title,
                description,
                workspaceId: parseInt(workspaceId),
                assignedUsers: {
                    createMany: {
                        data: userIdsArray.map((userId) => ({
                            userId: parseInt(userId),
                            permission: PermissionOnTask.MEMBER
                        }))
                    }
                }
            }

            if (deadline) {
                data.deadline = deadline
            }
            const task = await prisma.task.create({
                data
            })

            const destinationUpload = `conversation-${conversationId}/workspace-${workspaceId}/task-${task.id}`

            const uploadedFiles = await new Promise((resolve, reject) => {
                uploadFilesToGCS(files, destinationUpload, (error, data) => {
                    if (error) return reject(createError(500));
                    resolve(data);
                });
            });

            const taskAtFiles = await prisma.task.update({
                where: {
                    id: task.id
                },
                data: {
                    fileAttachments: {
                        upsert: uploadedFiles.map((file) => ({
                            where: { id: -1, url: file.url },
                            update: {
                                title: file.fileName,
                                size: parseFloat(file.size),
                                fileType: file.fileType
                            },
                            create: {
                                title: file.fileName,
                                url: file.url,
                                from: UploadDocumentWhere.WORKSPACE,
                                size: parseFloat(file.size),
                                ownerId: parseInt(userId),
                                privacy: TypePrivacy.PRIVATE,
                                fileType: file.fileType
                            }
                        }))
                    },

                },
                include: {
                    assignedUsers: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                        }
                    },
                    fileSubmissions: true,
                    fileAttachments: true,
                    workspace: true
                }
            });

            // log
            await logTaskHistory({
                action: ActionTask.CREATED,
                userId,
                taskId: taskAtFiles.id
            })

            res.status(201).json(taskAtFiles);

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // Update task
    updateTask: async (req, res, next) => {
        try {
            const { workspaceId, conversationId, taskId } = req.params;
            const { title, description, userIds, fileIds } = req.body;
            let deadline = req.body.deadline

            const files = req.files;
            const userId = req.payload.aud;

            if (deadline == "null") {
                deadline = null;
            }

            let userIdsArray = userIds
            let fileIdsArray = fileIds

            if (!Array.isArray(userIdsArray)) {
                if (userIdsArray) {
                    userIdsArray = [userIdsArray]
                } else {
                    userIdsArray = []
                }
            }

            if (!Array.isArray(fileIdsArray)) {
                if (fileIdsArray) {
                    fileIdsArray = [fileIdsArray]
                } else fileIdsArray = []
            }


            if (!title || !description) return next(createError(400, "Missing title or desciption"))

            const task = await prisma.task.findUnique({
                where: {
                    id: parseInt(taskId),
                },
                include: {
                    assignedUsers: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            }
                        }
                    },
                    fileAttachments: true,
                    fileSubmissions: true,
                }
            })

            const fileToDeleted = task.fileAttachments.filter((file) => !fileIdsArray.includes(file.id.toString()))

            const filePathArray = fileToDeleted.map((file) => {
                const v = file.url.split("/")
                v.shift()
                return v.join("/")
            });

            // Lấy danh sách ID của user hiện tại
            const existingUsers = task.assignedUsers.map(data => data.user);
            const usersToDisconnect = existingUsers.filter(user => !userIdsArray.includes(user.id.toString())); // Xóa user cũ
            const usersToConnectIds = userIdsArray.filter(id => !existingUsers.map(data => data.id.toString()).includes(id)).filter(id => !isNaN(id)); // Thêm user mới

            await prisma.task.update({
                where: {
                    id: parseInt(taskId)
                },
                data: {
                    title,
                    deadline,
                    description,
                    assignedUsers: {
                        deleteMany: {
                            userId: {
                                in: usersToDisconnect.map(data => parseInt(data.id)),
                            }
                        },
                        // Ngắt liên kết user cũ
                        createMany: {
                            data: usersToConnectIds.map(id => ({
                                userId: parseInt(id),
                            })) // Thêm user mới
                        }
                    }
                }
            })

            // log
            if (task.title != title) {
                await logTaskHistory({
                    action: ActionTask.TITLE_UPDATED,
                    oldValue: task.title,
                    newValue: title,
                    userId: parseInt(userId),
                    taskId: parseInt(taskId)
                })
            }

            if (task.description != description) {
                await logTaskHistory({
                    action: ActionTask.DESCRIPTION_UPDATED,
                    oldValue: task.description,
                    newValue: description,
                    userId: parseInt(userId),
                    taskId: parseInt(taskId)
                })
            }

            const deadlineTemp = task.deadline ? task.deadline.toISOString() : null

            if (deadlineTemp != deadline) {
                await logTaskHistory({
                    action: ActionTask.DEADLINE_UPDATED,
                    oldValue: task.deadline.toISOString(),
                    newValue: deadline,
                    userId: parseInt(userId),
                    taskId: parseInt(taskId)
                })
            }

            if (usersToDisconnect.length > 0) {
                const userOldValue = usersToDisconnect.map((user) => {
                    return {
                        userId: user.id,
                        fullname: user.userProfile.fullname,
                        avatar: user.userProfile.avatar,
                        email: user.email
                    }
                })

                await logTaskHistory({
                    action: ActionTask.USER_UNASSIGNED,
                    userId: parseInt(userId),
                    oldValue: JSON.stringify(userOldValue),
                    taskId: task.id
                })
            }

            const usersToConnect = await prisma.user.findMany({
                where: {
                    id: {
                        in: usersToConnectIds.map((id) => parseInt(id))
                    }
                },
                include: {
                    userProfile: true
                }
            })

            if (usersToConnect.length > 0) {
                const userNewValue = usersToConnect.map((user) => {
                    return {
                        userId: user.id,
                        fullname: user.userProfile.fullname,
                        avatar: user.userProfile.avatar,
                        email: user.email
                    }
                })

                await logTaskHistory({
                    action: ActionTask.USER_ASSIGNED,
                    userId: parseInt(userId),
                    newValue: JSON.stringify(userNewValue),
                    taskId: task.id
                })
            }

            if (filePathArray.length > 0) {
                await deleteFilesFromGCS(filePathArray, async (error, data) => {
                    if (error) next(createError(500))

                    await prisma.task.update({
                        where: {
                            id: parseInt(taskId)
                        },
                        data: {
                            fileAttachments: {
                                deleteMany: {
                                    id: {
                                        in: fileToDeleted.map((file) => file.id)
                                    }
                                }
                            }
                        }
                    })

                    const fileNames = fileToDeleted.map(file => file.title)

                    await logTaskHistory({
                        action: ActionTask.FILE_DELETED,
                        oldValue: JSON.stringify(fileNames),
                        taskId: parseInt(taskId),
                        userId: parseInt(userId)
                    })
                })
            }

            const destinationUpload = `conversation-${conversationId}/workspace-${workspaceId}/task-${task.id}`

            const uploadedFiles = await new Promise((resolve, reject) => {
                uploadFilesToGCS(files, destinationUpload, (error, data) => {
                    if (error) return reject(createError(500));
                    resolve(data);
                });
            });

            const taskAtFiles = await prisma.task.update({
                where: {
                    id: task.id
                },
                data: {
                    fileAttachments: {
                        upsert: uploadedFiles.map((file) => ({
                            where: { id: -1, url: file.url },
                            update: {
                                title: file.fileName,
                                size: parseFloat(file.size),
                                fileType: file.fileType
                            },
                            create: {
                                title: file.fileName,
                                url: file.url,
                                from: UploadDocumentWhere.WORKSPACE,
                                size: parseFloat(file.size),
                                ownerId: parseInt(userId),
                                privacy: TypePrivacy.PRIVATE,
                                fileType: file.fileType
                            }
                        }))
                    }
                },
                include: {
                    assignedUsers: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                        }
                    },
                    fileSubmissions: true,
                    fileAttachments: true,
                    workspace: true
                }
            });

            if (uploadedFiles.length > 0) {
                const fileNames = uploadedFiles.map(file => file.fileName)

                await logTaskHistory({
                    action: ActionTask.FILE_ATTACHED,
                    newValue: JSON.stringify(fileNames),
                    taskId: parseInt(taskId),
                    userId: parseInt(userId)
                })
            }

            res.status(201).json(taskAtFiles);


        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    addFilesToSubmit: async (req, res, next) => {
        try {
            const { workspaceId, conversationId, taskId } = req.params;
            const files = req.files
            const userId = req.payload.aud

            const taskToSubmit = await prisma.task.findUnique({
                where: {
                    id: parseInt(taskId),
                    status: "IN_PROGRESS"
                }
            })

            if (!taskToSubmit) return next(createError(404, "Not found task submission"))

            const destinationUpload = `conversation-${conversationId}/workspace-${workspaceId}/task-${taskId}/submissions`


            const uploadedFiles = await new Promise((resolve, reject) => {
                uploadFilesToGCS(files, destinationUpload, (error, data) => {
                    if (error) return reject(createError(500));
                    resolve(data);
                });
            });



            const taskAtFiles = await prisma.task.update({
                where: {
                    id: taskToSubmit.id
                },
                data: {
                    fileSubmissions: {
                        upsert: uploadedFiles.map((file) => ({
                            where: { id: -1, url: file.url },
                            update: {
                                title: file.fileName,
                                size: parseFloat(file.size),
                                fileType: file.fileType
                            },
                            create: {
                                title: file.fileName,
                                url: file.url,
                                from: UploadDocumentWhere.WORKSPACE,
                                size: parseFloat(file.size),
                                ownerId: parseInt(userId),
                                privacy: TypePrivacy.PRIVATE,
                                fileType: file.fileType
                            }
                        }))
                    }
                },
                include: {
                    assignedUsers: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                        }
                    },
                    fileSubmissions: true,
                    fileAttachments: true,
                    workspace: true
                }
            })

            const fileNamesLog = uploadedFiles.map(file => file.fileName)

            await logTaskHistory({
                userId: parseInt(userId),
                taskId: taskAtFiles.id,
                action: ActionTask.FILE_SUBMITTED,
                newValue: JSON.stringify(fileNamesLog)
            })

            return res.status(201).json(taskAtFiles);


        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    updateFileSubmit: async (req, res, next) => {
        try {
            const { workspaceId, conversationId, taskId } = req.params;
            const file = req.file
            const userId = req.payload.aud
            const { fileId } = req.body

            const taskToSubmit = await prisma.task.findUnique({
                where: {
                    id: parseInt(taskId),
                    status: "IN_PROGRESS"
                }
            })

            if (!taskToSubmit) return next(createError(404, "Not found task submission"))

            const fileOld = await prisma.file.findUnique({
                where: {
                    id: parseInt(fileId)
                }
            })

            if (!fileOld) return next(createError(404))


            const filePathOld = fileOld.url.split("/")
            filePathOld.shift()

            await deleteFileFromGCS(filePathOld.join("/"), () => { })

            const destinationUpload = `conversation-${conversationId}/workspace-${workspaceId}/task-${taskId}/submissions`
            const uploadedFile = await new Promise((resolve, reject) => {
                uploadFileToGCS(file.buffer, file.originalname, destinationUpload, { replace: false }, (error, data) => {
                    if (error) return reject(createError(500));
                    resolve(data);
                });
            });

            const fileUpdated = await prisma.file.update({
                where: {
                    id: fileOld.id
                },
                data: {
                    title: uploadedFile.fileName,
                    size: parseFloat(uploadedFile.size),
                    fileType: file.mimeType,
                    url: uploadedFile.url
                },
            })

            await logTaskHistory({
                action: ActionTask.FILE_CHANGED,
                userId: parseInt(userId),
                taskId: parseInt(taskId),
                oldValue: `${fileOld.title}`,
                newValue: `${fileUpdated.title}`
            })

            return res.status(201).json(fileUpdated);
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },

    // Submit task -> PENDING_REVIEW
    submitTask: async (req, res, next) => {
        try {
            const { workspaceId, conversationId, taskId } = req.params;
            const userId = req.payload.aud

            const taskToSubmit = await prisma.task.findUnique({
                where: {
                    id: parseInt(taskId),
                    status: "IN_PROGRESS"
                }
            })

            if (!taskToSubmit) return next(createError(404, "Not found task submission"))

            const taskAtFiles = await prisma.task.update({
                where: {
                    id: taskToSubmit.id
                },
                data: {
                    status: "PENDING_PREVIEW",
                },
                include: {
                    assignedUsers: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                        }
                    },
                    fileSubmissions: true,
                    fileAttachments: true,
                    workspace: true
                }
            })

            await logTaskHistory({
                userId,
                taskId: taskAtFiles.id,
                action: ActionTask.STATUS_CHANGED,
                oldValue: StatusTask.IN_PROGRESS,
                newValue: StatusTask.PENDING_PREVIEW
            })

            return res.status(201).json(taskAtFiles);

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // Publish task
    publishTask: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const userId = parseInt(req.payload.aud)

            const taskExist = await prisma.task.findFirst({
                where: {
                    id: parseInt(taskId),
                    status: "PENDING"
                },
            })

            if (!taskExist) return next(createError(404))

            const taskToPublish = await prisma.task.update({
                where: {
                    id: parseInt(taskId),
                },
                data: {
                    status: "IN_PROGRESS"
                },
                include: {
                    assignedUsers: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                        }
                    },
                    fileSubmissions: true,
                    fileAttachments: true,
                    workspace: true
                }
            })

            await logTaskHistory({
                userId,
                taskId: taskToPublish.id,
                action: ActionTask.STATUS_CHANGED,
                oldValue: StatusTask.PENDING,
                newValue: StatusTask.IN_PROGRESS
            })

            res.status(200).json(taskToPublish);
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // Preview task -> FINISH, FAILDED
    previewTask: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { status } = req.body;
            const userId = parseInt(req.payload.aud)


            const taskToPreview = await prisma.task.update({
                where: {
                    id: parseInt(taskId),
                    status: "PENDING_PREVIEW"
                },
                data: {
                    status
                },
                include: {
                    assignedUsers: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                        }
                    },
                    fileSubmissions: true,
                    fileAttachments: true,
                    workspace: true
                }
            })

            if (!taskToPreview) return next(createError(404, "Not found task to preview"))

            await logTaskHistory({
                userId,
                taskId: taskToPreview.id,
                action: ActionTask.STATUS_CHANGED,
                oldValue: StatusTask.PENDING_PREVIEW,
                newValue: status
            })

            res.status(200).json(taskToPreview)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // Remove file
    removeFileSubmit: async (req, res, next) => {
        try {
            const { fileId } = req.body;
            const userId = parseInt(req.payload.aud);
            const { taskId } = req.params;

            if (!fileId) return next(createError(400, "Missing fileId"))

            const file = await prisma.file.findUnique({
                where: {
                    id: parseInt(fileId)
                }
            })

            if (!file) return next(createError(404))

            const filePath = file.url.split("/")
            filePath.shift()

            await deleteFileFromGCS(filePath.join("/"), () => { })

            await logTaskHistory({
                userId,
                taskId: parseInt(taskId),
                action: ActionTask.FILE_REMOVED,
                oldValue: file.title,
            })

            res.status(200).json({ message: "Xóa thành công" })

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    getHistories: async (req, res, next) => {
        try {
            const { taskId } = req.params;

            const task = await prisma.task.findUnique({
                where: {
                    id: parseInt(taskId)
                },
                include: {
                    taskHistories: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: "desc"
                        }
                    }
                },
            })

            res.status(200).json(task.taskHistories)
        } catch (e) {
            console.log(e)
            next(createError(e))
        }
    },
    createAnnouncement: async (req, res, next) => {
        try {
            const { workspaceId, conversationId } = req.params;
            const { title, content } = req.body;
            const userId = req.payload.aud;

            const files = req.files;

            if (!title && !content) return next(createError(400, "Missing title or content"))

            const announcement = await prisma.announcement.create({
                data: {
                    title,
                    content,
                    workspaceId: parseInt(workspaceId),
                    userId: parseInt(userId),

                }
            })

            const destinationUpload = `conversation-${conversationId}/workspace-${workspaceId}/announcement-${announcement.id}`

            const uploadedFiles = await new Promise((resolve, reject) => {
                uploadFilesToGCS(files, destinationUpload, (error, data) => {
                    if (error) return reject(createError(500));
                    resolve(data);
                });
            });

            const announcementAtFiles = await prisma.announcement.update({
                where: {
                    id: announcement.id
                },
                data: {
                    files: {
                        upsert: uploadedFiles.map((file) => ({
                            where: { id: -1, url: file.url },
                            update: {
                                title: file.fileName,
                                size: parseFloat(file.size),
                                fileType: file.fileType
                            },
                            create: {
                                title: file.fileName,
                                url: file.url,
                                from: UploadDocumentWhere.WORKSPACE,
                                size: parseFloat(file.size),
                                ownerId: parseInt(userId),
                                privacy: TypePrivacy.PRIVATE,
                                fileType: file.fileType
                            }
                        }))
                    },

                },
                include: {
                    user: {
                        include: {
                            userProfile: true
                        }
                    },
                    files: true
                }
            });

            res.status(200).json(announcementAtFiles)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    updateAnnouncement: async (req, res, next) => {
        try {
            const { workspaceId, conversationId, announcementId } = req.params;
            const { title, content, fileIds } = req.body;
            const userId = req.payload.aud;

            const files = req.files;

            let fileIdsArray = fileIds

            if (!Array.isArray(fileIdsArray)) {
                if (fileIdsArray) {
                    fileIdsArray = [fileIdsArray]
                } else fileIdsArray = []
            }

            const announcement = await prisma.announcement.findUnique({
                where: {
                    id: parseInt(announcementId),
                },
                include: {
                    user: {
                        include: {
                            userProfile: true
                        }
                    },
                    files: true,
                }
            })

            const fileToDeleted = announcement.files.filter((file) => !fileIdsArray.includes(file.id.toString()))

            const filePathArray = fileToDeleted.map((file) => {
                const v = file.url.split("/")
                v.shift()
                return v.join("/")
            });

            if (filePathArray.length > 0) {
                await deleteFilesFromGCS(filePathArray, async (error, data) => {
                    if (error) next(createError(500))

                    await prisma.announcement.update({
                        where: {
                            id: parseInt(announcement.id)
                        },
                        data: {
                            files: {
                                deleteMany: {
                                    id: {
                                        in: fileToDeleted.map((file) => file.id)
                                    }
                                }
                            }
                        }
                    })
                })
            }

            const destinationUpload = `conversation-${conversationId}/workspace-${workspaceId}/announcement-${announcement.id}`

            const uploadedFiles = await new Promise((resolve, reject) => {
                uploadFilesToGCS(files, destinationUpload, (error, data) => {
                    if (error) return reject(createError(500));
                    resolve(data);
                });
            });

            const announcementAtFiles = await prisma.announcement.update({
                where: {
                    id: announcement.id
                },
                data: {
                    title,
                    content,
                    files: {
                        upsert: uploadedFiles.map((file) => ({
                            where: { id: -1, url: file.url },
                            update: {
                                title: file.fileName,
                                size: parseFloat(file.size),
                                fileType: file.fileType
                            },
                            create: {
                                title: file.fileName,
                                url: file.url,
                                from: UploadDocumentWhere.WORKSPACE,
                                size: parseFloat(file.size),
                                ownerId: parseInt(userId),
                                privacy: TypePrivacy.PRIVATE,
                                fileType: file.fileType
                            }
                        }))
                    },

                },
                include: {
                    user: {
                        include: {
                            userProfile: true
                        }
                    },
                    files: true
                }
            });

            res.status(200).json(announcementAtFiles)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    deleteTask: async (req, res, next) => {
        try {
            const { taskId } = req.params;

            const task = await prisma.task.findFirst({
                where: {
                    id: parseInt(taskId),
                    status: {
                        notIn: ["COMPLETED", "FAILED", "PENDING_PREVIEW"]
                    }
                }
            })

            if (!task) return next(createError(404, "Task not found"))

            const taskDeleted = await prisma.task.delete({
                where: {
                    id: task.id
                }
            })

            if (!taskDeleted) return next(createError(500, "Error when deleting task"))

            return res.status(200).json(taskDeleted)
        } catch (e) {
            console.log(e);
            next(createError(500))
        }
    },
    deleteAnnouncement: async (req, res, next) => {
        try {
            const { announcementId } = req.params;

            const announcement = await prisma.announcement.findFirst({
                where: {
                    id: parseInt(announcementId),
                }
            })

            if (!announcement) return next(createError(404, "Announcement not found"))

            const announcementDeleted = await prisma.announcement.delete({
                where: {
                    id: announcement.id
                }
            })

            if (!announcementDeleted) return next(createError(500, "Error when deleting announcement"))

            return res.status(200).json(announcementDeleted)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    deleteFileSubmit: async (req, res, next) => {
        try {
            const { taskId } = req.params;
            const { fileId } = req.body;
            const userId = req.payload.aud;

            const task = await prisma.task.findFirst({
                where: {
                    id: parseInt(taskId),
                    fileSubmissions: {
                        some: {
                            id: parseInt(fileId)
                        }
                    }
                }
            })

            if (!task) return next(createError(404, "File not found in task"))

            const file = await prisma.file.findUnique({
                where: {
                    id: parseInt(fileId)
                }
            })

            const taskUpated = await prisma.task.update({
                where: {
                    id: parseInt(taskId)
                },
                data: {
                    fileSubmissions: {
                        disconnect: {
                            id: file.id
                        }
                    }
                },
                include: {
                    assignedUsers: {
                        include: {
                            user: {
                                include: {
                                    userProfile: true
                                }
                            },
                        }
                    },
                    fileSubmissions: true,
                    fileAttachments: true,
                    workspace: true
                }

            })

            if (file.from == "WORKSPACE") {
                const filePath = file.url.split("/")
                filePath.shift()

                await deleteFileFromGCS(filePath.join("/"), () => { })

            }

            await logTaskHistory({
                userId,
                taskId: parseInt(taskId),
                action: ActionTask.FILE_REMOVED,
                oldValue: file.title,
            })

            res.status(200).json(taskUpated)

        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    }
}

module.exports = taskController