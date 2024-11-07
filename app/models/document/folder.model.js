const { UploadDocumentWhere } = require("@prisma/client");
const prisma = require("../../services/prisma");

class Folder {
    static get model() {
        return prisma.folder
    }

    constructor({
        id = null,
        title,
        url,
        size,
        from,
        privacy,
        ownerId,
        groupId = null,
        parentFolderId = null
    }) {
        this.id = id;
        this.title = title;
        this.url = url;
        this.size = size;
        this.privacy = privacy;
        this.from = from ?? UploadDocumentWhere.USER;
        this.ownerId = ownerId;
        this.groupId = groupId ? parseInt(groupId) : null;
        this.parentFolderId = parentFolderId;
    }

    data() {
        return {
            title: this.title,
            url: this.url,
            size: this.size,
            from: this.from,
            privacy: this.privacy,
            ownerId: this.ownerId,
            groupId: this.groupId,
            parentFolderId: this.parentFolderId
        }
    }

    updateId(id) {
        this.id = id
    }

    async update({ data }) {
        if (this.id) {
            if (data.size) {
                await this.updateSizeParentFolder({ isChange: true, changeSize: parseInt(data.size) - parseInt(this.size) })
            }

            console.log("value size: " + data.size)

            Object.keys(data).forEach(key => {
                this[key] = data[key]
            });

            return await prisma.folder.update({
                where: { id: this.id },
                data: {
                    ...data
                }
            })
        }
    }

    async deleteAllFiles() {
        if (this.id) {
            // Xóa tất cả các tập tin trong thư mục hiện tại
            await prisma.file.deleteMany({
                where: {
                    folderId: parseInt(this.id)
                }
            });

            // Tìm tất cả các thư mục con
            const subFolders = await prisma.folder.findMany({
                where: {
                    parentFolderId: parseInt(this.id)
                }
            });

            for (const subFolder of subFolders) {
                const folderInstance = new Folder(subFolder.id);
                await folderInstance.deleteAllFiles();
                await prisma.folder.delete({
                    where: {
                        id: subFolder.id
                    }
                });
            }
        }
    }


    async save() {
        let folder;
        if (this.id) {
            const { size: currentSize } = await prisma.folder.findUnique(
                {
                    where: {
                        id: this.id
                    }
                }
            )

            if (currentSize != this.size) {
                await this.updateSizeParentFolder({ isChange: true, changeSize: parseFloat(this.size) - parseFloat(currentSize) })
            }

            // Cập nhật thư mục
            folder = await prisma.folder.update({
                where: { id: this.id },
                data: this.data()
            });


        } else {
            // Tạo thư mục mới
            folder = await prisma.folder.create({
                data: this.data()
            });
            this.id = folder.id;

            await this.updateSizeParentFolder();
        }

        return folder;
    }

    async updateSizeParentFolder({ isCreated = true, isChange = false, changeSize = 0 } = {}) {
        if (!isChange) changeSize = 0;
        if (isChange) isCreated = false;
        if (this.id) {
            let currentFolder = await prisma.folder.findUnique({
                where: { id: this.id },
            });

            // Lặp qua các parentFolder cho đến khi không còn parentId (root)
            while (currentFolder && currentFolder.parentFolderId) {
                const parentFolder = await prisma.folder.findUnique({
                    where: { id: currentFolder.parentFolderId },
                    select: { id: true, parentFolderId: true, size: true }
                });

                if (parentFolder) {
                    let size;
                    if (isCreated) {
                        size = parseFloat(parentFolder.size) + parseFloat(currentFolder.size);
                    } else if (isChange) {
                        size = parseFloat(parentFolder.size) + parseFloat(changeSize);
                    }

                    await prisma.folder.update({
                        where: {
                            id: parentFolder.id
                        },
                        data: {
                            size: parseFloat(size)
                        }
                    })
                    currentFolder = parentFolder;  // Chuyển tiếp tới thư mục cha tiếp theo
                } else {
                    break; // Nếu không tìm thấy thư mục cha thì dừng
                }
            }
        }
    };

    static async getFullPathFolder(folderId = this.id) {
        let currentFolder = await prisma.folder.findUnique({
            where: { id: folderId },
            select: { title: true, parentFolderId: true }
        });

        if (!currentFolder) return null;

        let fullPath = currentFolder.title;  // Bắt đầu với thư mục hiện tại

        // Lặp qua các thư mục cha
        while (currentFolder && currentFolder.parentFolderId) {
            currentFolder = await prisma.folder.findUnique({
                where: { id: currentFolder.parentFolderId },
                select: { title: true, parentFolderId: true }
            });

            if (currentFolder) {
                fullPath = currentFolder.title + '/' + fullPath;  // Ghép đường dẫn
            }
        }

        return fullPath;  // Trả về đường dẫn đầy đủ
    }

    static async getInfoFolder(id) {
        let folder = {};
        let parents = [];
        let currentFolder = await prisma.folder.findUnique({
            where: { id: parseInt(id) },
            include: {
                parentFolder: true
            }
        });

        if (!currentFolder) return null;

        folder.data = currentFolder;
        folder.type = "folder";

        while (currentFolder && currentFolder.parentFolderId) {
            const parentFolder = await prisma.folder.findUnique({
                where: { id: currentFolder.parentFolderId },
                include: {
                    parentFolder: true
                }
            });

            if (parentFolder) {
                parents.push(parentFolder);
                currentFolder = parentFolder;
            } else {
                break;
            }
        }

        return {
            folder: folder.data,
            parents: parents.reverse()
        };
    }

    static async delete(id) {
        if (id) {
            const folderDeleted = await prisma.folder.delete({
                where: {
                    id: parseInt(id)
                },
                include: {
                    files: true
                }
            })

            // update size folder
            if (folderDeleted.parentFolderId) {
                const parentFolder = await prisma.folder.findUnique({
                    where: {
                        id: folderDeleted.parentFolderId
                    }
                })


                if (parentFolder) {
                    const gapSize = - folderDeleted.size;
                    const currentFolder = new Folder({ ...parentFolder })
                    await currentFolder.update({
                        data: {
                            size: parseFloat(parentFolder.size) + parseFloat(gapSize)
                        }
                    })
                }
            }

            return folderDeleted;
        }
    }

    static async get(id) {
        if (id) {
            return await prisma.folder.findUnique({
                where: {
                    id: parseInt(id)
                }
            })
        }
    }

    static async getAll({ where, orderBy, select }) {
        return await prisma.folder.findMany({
            where,
            orderBy,
            select,
            include: {
                owner: {
                    include: {
                        userProfile: true
                    }
                }
            }
        })
    }
}

module.exports = Folder;