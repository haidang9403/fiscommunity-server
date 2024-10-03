const createError = require("http-errors");
const File = require("../models/document/file.model");
const { TypePrivacy, UploadDocumentWhere } = require("@prisma/client");
const UserRelation = require("../models/users/user.relation.model");
const Folder = require("../models/document/folder.model");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary/delete.util");
const Media = require("../models/media.model");

const userAccess = {
    //-------- DOCUMENT ----------//
    document: async (req, res, next) => {
        try {
            let files = req.body.files ?? [];
            let folders = req.body.folders ?? [];
            const userId = parseInt(req.payload.aud);

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
                            id: parseInt(id),
                        }
                    })

                    if (!file) return false

                    if (file.from == UploadDocumentWhere.GROUP || file.from == UploadDocumentWhere.MESSAGE) return false

                    if (userId == file.ownerId) return true;
                    if (file.privacy == TypePrivacy.PUBLIC) return true;
                    if (file.privacy == TypePrivacy.FRIENDS) {
                        const isFriend = await UserRelation.isAddedFriend(userId, file.ownerId)
                        if (isFriend) return true
                    }

                    return false;
                }))

                isContinue = results.every(result => result);
            }

            if (folders.length > 0) {
                const results = await Promise.all(folders.map(async (id) => {
                    const folder = await Folder.model.findUnique({
                        where: {
                            id: parseInt(id),
                        }
                    })

                    if (!folder) return false

                    if (folder.from == UploadDocumentWhere.GROUP || folder.from == UploadDocumentWhere.MESSAGE) return false

                    if (userId == folder.ownerId) return true;
                    if (folder.privacy == TypePrivacy.PUBLIC) return true;
                    if (folder.privacy == TypePrivacy.FRIENDS) {
                        const isFriend = await UserRelation.isAddedFriend(userId, folder.ownerId)
                        if (isFriend) return true
                    }

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
    }
}

module.exports = userAccess;