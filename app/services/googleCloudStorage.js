const { Storage } = require("@google-cloud/storage");
const config = require("../config");

const storage = new Storage({
    keyFile: config.google.credential,
    projectId: "fisnote-437407"
});


const bucket = storage.bucket("fisnote");

module.exports = bucket;