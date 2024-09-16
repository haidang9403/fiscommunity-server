const bucket = require("../../services/googleCloudStorage");

const fileExists = async (fileName) => {
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    return exists;
};

const deleteFileFromGCS = async (filePath, callback) => {
    try {
        const file = await fileExists(filePath);
        if (file) {
            await bucket.file(filePath).delete();
            callback(null, { success: true, message: "Xóa file thành công", statusCode: 200 });
        } else {
            callback(null, { succes: true, message: "File không tồn tại", statusCode: 404 })
        }
    } catch (e) {
        callback(e, null);
    }
}

const deleteFolderFromGCS = async (folder, callback) => {
    try {
        const [files] = await bucket.getFiles({ prefix: folder });

        if (files.length === 0) {
            callback(null, { success: false, message: "Thư mục không tồn tại", statusCode: 404 })
        }

        const deletePromises = files.map(file => file.delete())
        await Promise.all(deletePromises);

        callback(null, { success: true, message: "Xóa thư mục thành công", statusCode: 200 })
    } catch (e) {
        callback(e, null);
    }
}

module.exports = {
    deleteFileFromGCS,
    deleteFolderFromGCS
}