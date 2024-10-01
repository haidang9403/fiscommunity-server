const cloudinary = require('../../services/cloudinary');

const deleteMediaFromCloudinary = async (media) => {
    const public_id = media.url.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, '');
    const { result } = await cloudinary.uploader.destroy(public_id, { resource_type: media.type.toLowerCase() });

    return result;
}

const deleteImageFromCloudinary = async (url) => {
    const public_id = url.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, '');
    const { result } = await cloudinary.uploader.destroy(public_id, "image");

    return result;
}

module.exports = {
    deleteMediaFromCloudinary,
    deleteImageFromCloudinary
}