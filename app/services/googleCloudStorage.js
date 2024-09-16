const { Storage } = require("@google-cloud/storage");
const config = require("../config");

const storage = new Storage({
    keyFile: config.google.credential,
    projectId: "fisnote"
});

const bucket = storage.bucket("fisnote-bucket");

module.exports = bucket;