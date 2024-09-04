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
    }
}

module.exports = config;