const prisma = require("../services/prisma");
const { TypeMedia } = require("../enums")

class Media {
    static get model() {
        return prisma.media
    }

    constructor({
        id = null,
        url,
        caption = "",
        type = TypeMedia.IMAGE,
        postId
    }) {
        this.id = id;
        this.url = url;
        this.caption = caption;
        this.type = type;
        this.postId = parseInt(postId);
    }

    async save() {
        const updateData = {};

        if (this.url !== null && this.url !== undefined) {
            updateData.url = this.url;
        }
        if (this.caption !== null && this.caption !== undefined) {
            updateData.caption = this.caption;
        }

        return await prisma.media.upsert({
            where: {
                id: this.id ?? -1,
            },
            create: {
                url: this.url ?? "",
                caption: this.caption,
                type: this.type,
                post: {
                    connect: {
                        id: parseInt(this.postId) || -1
                    }
                }
            },
            update: updateData
        })
    }

    static getTypeMedia(file) {
        return file.mimetype.startsWith('image/') ? TypeMedia.IMAGE : (file.mimetype.startsWith('video/') ? TypeMedia.VIDEO : "")
    }
}

module.exports = Media;