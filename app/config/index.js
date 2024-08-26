require("dotenv").config();

const config = {
    app: {
        // eslint-disable-next-line no-undef
        port: process.env.PORT || 3000
    },
}

module.exports = config;