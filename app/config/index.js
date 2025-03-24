require("dotenv").config();

const config = {
    app: {
        // eslint-disable-next-line no-undef
        port: process.env.PORT || 3000
    },
    jwt: {
        // eslint-disable-next-line no-undef
        access_key: process.env.JWT_ACCESS_KEY,
        // eslint-disable-next-line no-undef
        refresh_key: process.env.JWT_REFRESH_KEY
    },
    google: {
        // eslint-disable-next-line no-undef
        credential: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        // eslint-disable-next-line no-undef
        base_url_upload: process.env.BASE_URL_UPLOAD,
    },
    cloudinary: {
        // eslint-disable-next-line no-undef
        name: process.env.CLOUND_NAME,
        // eslint-disable-next-line no-undef
        api_key: process.env.CLOUND_API_KEY,
        // eslint-disable-next-line no-undef
        api_secret: process.env.CLOUND_API_SECRET
    },
    liveKit: {
        // eslint-disable-next-line no-undef
        api_key: process.env.LIVEKIT_API_KEY,
        // eslint-disable-next-line no-undef
        api_secret: process.env.LIVEKIT_SECRET,
        // eslint-disable-next-line no-undef
        url: process.env.LIVEKIT_URL
    },
    n8n: {
        // eslint-disable-next-line no-undef
        url: process.env.AI_AGENT_URL
    },
    onlyOffice: {
        // eslint-disable-next-line no-undef
        secret_key: process.env.ONLYOFFICE_SECRET,
        // eslint-disable-next-line no-undef
        callback_url_edit: process.env.ONLYOFFICE_CALLBACK_URL_EDIT,
    }
}

module.exports = config;