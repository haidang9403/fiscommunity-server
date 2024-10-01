const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require('../../services/cloudinary');
const createError = require("http-errors");

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folderName = 'posts';
        let resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';

        return {
            folder: folderName,
            resource_type: resourceType,
        };
    },
});



const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true); // Chấp nhận file
    } else {
        cb(createError(400, 'Only images and videos are allowed!'), false); // Từ chối file không hợp lệ
    }
};

const uploadMediaToCloudinary = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
    }
})

const storageImage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "images",
        resource_type: "image",
    }
});

const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true); // Chấp nhận file
    } else {
        cb(createError(400, 'Only images is allowed!'), false); // Từ chối file không hợp lệ
    }
};

const uploadImageToCloudinary = multer({
    storage: storageImage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
    }
})

module.exports = {
    uploadMediaToCloudinary,
    uploadImageToCloudinary
}