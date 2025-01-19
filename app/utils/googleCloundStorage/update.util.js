const bucket = require("../../services/googleCloudStorage");

const updateFileGCS = async (oldFilePath, newFilePath) => {
    try {
        const file = bucket.file(oldFilePath);
        await file.move(newFilePath);

        const newFile = bucket.file(newFilePath);

        const [metadata] = await newFile.getMetadata();

        return {
            result: true,
            fileName: newFile.name.split("/").pop(),
            fileType: metadata.contentType,
            filePath: bucket.name + "/" + newFilePath
        };
    } catch (e) {
        console.log(e)
        return {
            result: false
        };
    }

}

const updateFolderGCS = async (oldFolderPath, newFolderPath) => {
    try {
        const [files] = await bucket.getFiles({ prefix: oldFolderPath })

        // Hàm xử lý di chuyển file
        const moveFile = async (file) => {
            const newFileName = file.name.replace(oldFolderPath, newFolderPath);
            await file.move(newFileName);
        };

        // Sử dụng p-map để xử lý song song
        const { default: pMap } = await import("p-map");
        await pMap(files, moveFile, { concurrency: 10 });

        return {
            result: true,
            folderName: newFolderPath.split("/").pop(),
            folderPath: bucket.name + "/" + newFolderPath
        };
    } catch (e) {
        console.log(e)
        return {
            result: false
        }
    }
}

module.exports = {
    updateFileGCS,
    updateFolderGCS
}
