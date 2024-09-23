const prisma = require("../../services/prisma");
const Folder = require("./folder.model");

class File {
    static get model() {
        return prisma.file
    }

    constructor({ id = null, title, url, size, ofGroup = false, ownerId, groupId = null, folderId = null }) {
        this.id = id;
        this.title = title;
        this.url = url;
        this.size = size;
        this.ofGroup = ofGroup;
        this.ownerId = parseInt(ownerId);
        this.groupId = parseInt(groupId);
        this.folderId = parseInt(folderId);
    }

    data() {
        return {
            title: this.title,
            url: this.url,
            size: BigInt(this.size),
            ofGroup: this.ofGroup,
            ownerId: this.ownerId,
            groupId: this.groupId,
            folderId: this.folderId
        }
    }

    async save() {
        let file;

        const replaceFile = await prisma.file.findFirst({
            where: {
                title: this.title,
                folderId: this.folderId
            }
        })

        if (replaceFile) {
            this.id = replaceFile.id;
            const { size: currentSize } = await prisma.file.findUnique({
                where: {
                    id: this.id
                }
            })

            file = await prisma.file.update({
                where: { id: this.id },
                data: this.data(),
            })

            if (this.folderId) {

                const gapSize = parseInt(this.size) - parseInt(currentSize);
                const folder = await prisma.folder.findUnique({
                    where: {
                        id: this.folderId
                    }
                })

                if (folder) {
                    const currentFolder = new Folder({ ...folder })
                    await currentFolder.update({
                        data: {
                            size: BigInt(parseInt(folder.size) + gapSize)
                        }
                    })
                }
            }

        } else if (this.id) {
            const { size: currentSize } = await prisma.file.findUnique({
                where: {
                    id: this.id
                }
            })

            file = await prisma.file.update({
                where: { id: this.id },
                data: this.data(),
            })

            if (this.folderId) {
                const gapSize = parseInt(this.size) - parseInt(currentSize);
                const folder = await prisma.folder.findUnique({
                    where: {
                        id: this.folderId
                    }
                })


                if (folder) {
                    const currentFolder = new Folder({ ...folder })
                    await currentFolder.update({
                        data: {
                            size: BigInt(parseInt(folder.size) + gapSize)
                        }
                    })
                }
            }
        } else {
            file = await prisma.file.create({
                data: this.data()
            })

            if (this.folderId) {
                const folder = await prisma.folder.findUnique({
                    where: {
                        id: this.folderId
                    }
                })

                const currentFolder = new Folder({ ...folder })

                await currentFolder.update({
                    data: {
                        size: BigInt(parseInt(folder.size) + parseInt(file.size))
                    }
                })
            }


            this.id = file.id;
        }
        return file;
    }

    static async delete(id) {
        if (id) {
            const fileDeleted = await prisma.file.delete({
                where: {
                    id: parseInt(id)
                }
            })

            // update size folder
            this.updateSizeFolderFromFile(fileDeleted.folderId, - fileDeleted.size)

            return fileDeleted;
        }
    }

    static async get(id) {
        if (id) {
            return await prisma.file.findUnique({
                where: {
                    id: parseInt(id)
                }
            })
        }
    }

    static async updateSizeFolderFromFile(folderId, gapSize) {
        if (folderId) {
            const folder = await prisma.folder.findUnique({
                where: {
                    id: parseInt(folderId)
                }
            })


            if (folder) {
                const currentFolder = new Folder({ ...folder })
                await currentFolder.update({
                    data: {
                        size: BigInt(parseInt(folder.size) + parseInt(gapSize))
                    }
                })
            }
        }
    }

    static async getAll({ where, orderBy, select }) {
        return await prisma.file.findMany({
            where,
            orderBy,
            select,
        })
    }
}

module.exports = File;