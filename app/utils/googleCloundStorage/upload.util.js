const multer = require("multer");
const bucket = require("../../services/googleCloudStorage");
const { format } = require("util");

const uploadMiddleware = multer({ storage: multer.memoryStorage() });

// Kiểm tra tồn tại file
const fileExists = async (fileName) => {
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    return exists;
};

// Kiểm tra tồn tại folder
const folderExists = async (folderPath) => {
    const [files] = await bucket.getFiles({ prefix: folderPath });
    return files.length > 0;
};

const getUniqueFileName = async (fileName, destFolder) => {
    let uniqueFileName = fileName;
    let fileExistsFlag = await fileExists(`${destFolder}/${uniqueFileName}`);

    let counter = 1;
    while (fileExistsFlag) {
        const nameParts = fileName.split('.');
        const baseName = nameParts.slice(0, -1).join('.');
        const extension = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
        uniqueFileName = `${baseName}(${counter})${extension}`;
        fileExistsFlag = await fileExists(`${destFolder}/${uniqueFileName}`);
        counter++;
    }

    console.log("File: " + uniqueFileName);


    return uniqueFileName;
};

const getUniqueFolderName = async (folderPath) => {
    let uniqueFolderPath = folderPath;
    let folderExistsFlag = await folderExists(uniqueFolderPath);

    let counter = 1;
    while (folderExistsFlag) {
        uniqueFolderPath = `${folderPath} - Copy${counter == 1 ? '' : " (" + counter + ")"}`;
        folderExistsFlag = await folderExists(uniqueFolderPath);
        counter++;
    }

    return uniqueFolderPath;
};

const uploadFileToGCS = async (fileBuffer, fileName, destFolder, options = { replace: false }, callback) => {
    try {
        if (!options.replace) {
            // Nếu không thay thế, tạo tên file mới nếu bị trùng
            fileName = await getUniqueFileName(fileName, destFolder);
        }

        let filePath = `${destFolder}/${fileName}`;

        const blob = bucket.file(`${filePath}`);
        const blobStream = blob.createWriteStream({
            resumable: false, // Không tiếp tục nếu quá trình tải lên bị gián đoạn
        });

        blobStream.on('error', (err) => {
            callback(err, null);
        });

        blobStream.on('finish', async () => {
            // await blob.makePrivate();
            // Lấy thông tin về file
            const [metadata] = await blob.getMetadata();
            const fileSizeMB = (metadata.size / (1024 * 1024)).toFixed(4);
            const publicUrl = format(`${bucket.name}/${blob.name}`);
            callback(null, { fileName, url: publicUrl, size: fileSizeMB });
        });

        // Ghi dữ liệu file lên Cloud Storage
        blobStream.end(fileBuffer);
    } catch (err) {
        callback(err, null);
    }
};

const uploadFolderToGCS = async (files, destFolder, options = { replace: false }, callback) => {
    // Xóa / ở cuối destFolder
    destFolder = destFolder.replace(/\/$/, '');

    if (!options.replace) {
        destFolder = await getUniqueFolderName(destFolder);
        console.log(destFolder)
    } else {
        // Nếu thay thế, xóa tất cả các file trong thư mục cũ trước khi tải lên mới
        const [existingFiles] = await bucket.getFiles({ prefix: destFolder });
        const deletePromises = existingFiles.map(file => file.delete());
        await Promise.all(deletePromises);
    }

    const results = [];
    const errors = [];

    if (files.length === 0) {
        // Tạo một file placeholder để đại diện cho thư mục
        const placeholderFileName = `${destFolder}/.keep`; // Tạo một file .keep

        try {
            await bucket.file(placeholderFileName).save('', { resumable: false });

            const folder = {
                folderName: destFolder.split("/").filter(Boolean).pop(),
                size: 0,
                url: bucket.name + "/" + destFolder
            };

            callback(null, { results: [], folder, errors });
        } catch (err) {
            callback(err, {});
        }

        return; // Kết thúc nếu không có file nào để upload
    }

    const uploadPromises = files.map(async (file) => {
        return new Promise((resolve, reject) => {
            uploadFileToGCS(file.buffer, file.originalname, destFolder, options, (err, result) => {
                if (err) {
                    errors.push(err);
                    reject(err);
                } else {
                    results.push({ ...result });
                    resolve();
                }
            });
        });
    });

    try {
        await Promise.all(uploadPromises);

        const totalSize = results.reduce((total, result) => {
            return (parseFloat(total) + parseFloat(result.size))
        }, 0)

        const folderName = destFolder.split("/").filter(Boolean).pop();

        const folder = {
            folderName,
            size: totalSize.toFixed(4),
            url: bucket.name + "/" + destFolder
        }

        callback(null, { results, folder, errors });
    } catch (err) {
        callback(err, null);
    }
};

module.exports = {
    uploadMiddleware,
    uploadFileToGCS,
    uploadFolderToGCS
}