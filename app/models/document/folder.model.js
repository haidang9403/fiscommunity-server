const prisma = require("../../services/prisma");

class Folder {
    static get model() {
        return prisma.folder
    }

    constructor({ id = null, title, url, size, ofGroup, ownerId, groupId = null, parentFolderId = null }) {
        this.id = id;
        this.title = title;
        this.url = url;
        this.size = size;
        this.ofGroup = ofGroup;
        this.ownerId = ownerId;
        this.groupId = groupId;
        this.parentFolderId = parentFolderId;
    }

    data() {
        return {
            title: this.title,
            url: this.url,
            size: this.size,
            ofGroup: this.ofGroup,
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
            await prisma.file.deleteMany({
                where: {
                    folderId: this.id
                }
            })
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
                await this.updateSizeParentFolder({ isChange: true, changeSize: parseInt(this.size) - parseInt(currentSize) })
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
                        size = parseInt(parentFolder.size) + parseInt(currentFolder.size);
                    } else if (isChange) {
                        size = parseInt(parentFolder.size) + parseInt(changeSize);
                    }

                    await prisma.folder.update({
                        where: {
                            id: parentFolder.id
                        },
                        data: {
                            size: BigInt(size)
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

    static async delete(id) {
        if (id) {
            const folderDeleted = await prisma.folder.delete({
                where: {
                    id: parseInt(id)
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
                            size: BigInt(parseInt(parentFolder.size) + parseInt(gapSize))
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
        })
    }
}

module.exports = Folder;