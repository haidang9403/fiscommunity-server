const config = require("./app/config");
const { server } = require("./app/services/socket-io");

const startServer = async () => {
    try {
        const PORT = config.app.port;

        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.log(`Can't start server!`);
        console.error(error);
    }
};

startServer();