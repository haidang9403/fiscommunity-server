const bucket = require("../../services/googleCloudStorage");
const archiver = require("archiver")
const { PassThrough } = require('stream')


const getFileFromGCS = async (filePath, callback) => {
    try {
        const file = await bucket.file(filePath);
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // Hết hạn sau 15p
        })

        callback(null, { url: url })
    } catch (e) {
        console.log(e)
        callback(e, null)
    }
}

const getFolderFromGCS = async (folderPath, callback) => {
    try {
        const [files] = await bucket.getFiles({ prefix: folderPath });

        if (files.length === 0) {
            callback(null, { status: 404, message: 'No files found in the folder.' });
            return;
        }

        const fileList = files;
        callback(null, { fileList });
    } catch (e) {
        callback(e, null);
    }
};

module.exports = {
    getFileFromGCS,
    getFolderFromGCS
}