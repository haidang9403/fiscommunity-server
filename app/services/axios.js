const axios = require("axios")

const commonConfig = {
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
};

module.exports = (baseURL, newConfig = {}) => {
    return axios.create({
        baseURL,
        ...commonConfig,
        ...newConfig
    });
};