const app = require("./app");
const config = require("./app/config")
const { createServer } = require('node:http');
const { Server } = require('socket.io');

const { PrismaClient } = require('@prisma/client');

const startServer = async () => {
    try {
        const server = createServer(app);
        const io = new Server(server);
        global.io = io;

        const prisma = new PrismaClient();
        global.prisma = prisma;

        io.on('connection', (socket) => {
            socket.on("hello", (data) => {
                console.log(data);
            })
        });

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