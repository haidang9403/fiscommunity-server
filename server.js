const app = require("./app");
const config = require("./app/config")

const startServer = async () => {
    try {

        const PORT = config.app.port;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.log(`Can't start server!`);
        console.error(error);
    }
};

startServer();