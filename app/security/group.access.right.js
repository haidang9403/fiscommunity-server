const { TypePrivacy, GroupPermission } = require("@prisma/client");
const Group = require("../models/groups/group.model");
const createError = require("http-errors");
const File = require("../models/document/file.model");
const Folder = require("../models/document/folder.model");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary/delete.util");
const Media = require("../models/media.model");
const UserAttendGroup = require("../models/groups/user.attend.group.model");
const prisma = require("../services/prisma");
const Post = require("../models/post.model");

const groupAccess = {
    //----------- ACCESS DOCUMENT GROUP----------//
    document: async (req, res, next) => {
        try {
            let files = req.body.files ?? [];

            let folders = req.body.folders ?? [];
            // const userId = parseInt(req.payload.aud);
            const groupId = req.params.groupId ? parseInt(req.params.groupId) : null;
            console.log(groupId)
            if (!groupId) return next(createError(404, "Group is invalid"))

            const group = await Group.model.findUnique({
                where: {
                    id: groupId
                }
            })

            if (!group) return next(createError(404))

            if (typeof (folders) == "string") {
                folders = [folders]
            }

            if (typeof (files) == "string") {
                files = [files]
            }

            let isContinue = true;

            if (files.length > 0) {
                const results = await Promise.all(files.map(async (id) => {
                    const file = await File.model.findUnique({
                        where: {
                            id: parseInt(id)
                        }
                    })

                    if (!file) return false

                    if (file.groupId == group.id) return true;

                    return false;
                }))

                isContinue = results.every(result => result);
            }

            if (folders.length > 0) {
                const results = await Promise.all(folders.map(async (id) => {
                    const folder = await Folder.model.findUnique({
                        where: {
                            id: parseInt(id)
                        }
                    })

                    if (!folder) return false


                    if (folder.groupId == group.id) return true;

                    return false;
                }))

                isContinue = results.every(result => result);
            }

            if (isContinue) {
                return next()
            }

            const medias = req.files;
            if (medias && medias.length > 0) {
                for (const media of medias) {
                    const result = await deleteMediaFromCloudinary({
                        url: media.path,
                        type: Media.getTypeMedia(media)
                    });
                    if (result != 'ok') return next(createError(500, "Error when create post"))
                }
            }

            return next(createError(403, "You are not permission to access this document"))
        } catch (e) {
            console.log(e)
            const medias = req.files;
            if (medias && medias.length > 0) {
                for (const media of medias) {
                    const result = await deleteMediaFromCloudinary({
                        url: media.path,
                        type: Media.getTypeMedia(media)
                    });
                    if (result != 'ok') return next(createError(500, "Error when create post"))
                }
            }
            return next(createError(500, "Error when access document"))
        }
    },
    post: async (req, res, next) => {
        try {
            const userId = parseInt(req.payload.aud);
            const postId = parseInt(req.params.postId);
            const groupId = req.params.groupId ? parseInt(req.params.groupId) : null;

            if (!groupId) return next(createError(404, "Group is invalid"))
            if (!postId) return next(createError(404, "Post is invalid"))

            const group = await Group.model.findUnique({
                where: {
                    id: groupId
                }
            })

            const post = await Post.model.findUnique({
                where: {
                    id: postId
                }
            })

            if (!post || !group) return next(createError(404))

            if (post.groupId != group.id) return next(createError(404, "Post not found in group"))

            let isContinue = true

            if (post.ownerId != userId) isContinue = false;
            if (req.method == 'DELETE') {
                const userPermission = await prisma.userAttendGroup.findFirst({
                    where: {
                        groupId: parseInt(groupId),
                        userId: parseInt(userId)
                    }
                })

                if (userPermission.permission == GroupPermission.ADMIN) isContinue = true;
            }

            if (isContinue) return next()

            return next(createError(403, "You are not permission to access this post"))
        } catch (e) {
            console.log(e)
            next(createError(500, "Error when access post"))
        }
    },
    postExist: async (req, res, next) => {
        try {
            const postId = parseInt(req.params.postId);
            const userId = parseInt(req.payload.aud);
            const groupId = req.params.groupId ? parseInt(req.params.groupId) : null;

            if (!groupId) return next(createError(404, "Group is invalid"))
            if (!postId) return next(createError(404, "Post is invalid"))

            const group = await Group.model.findUnique({
                where: {
                    id: groupId
                }
            })

            const post = await Post.model.findFirst({
                where: {
                    id: postId,
                }
            })

            if (!post || !group) return next(createError(404))

            const userPermission = await prisma.userAttendGroup.findFirst({
                where: {
                    userId,
                    groupId
                }
            })

            if (post.groupId != group.id) return next(createError(404, "Post not found in group"))
            if (userPermission.permission == GroupPermission.ADMIN) return next()
            if (post.isApproved == false) return next(createError(403, "Post is not ready to access"))
            return next()
        } catch (e) {
            console.log(e)
            return next(createError(500, "Error when access post"))
        }
    },
}

module.exports = groupAccess