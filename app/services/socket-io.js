const app = require("../../app");
const { createServer } = require('node:http');
const { Server } = require('socket.io');

const server = createServer(app);

const io = new Server(server);

app.set('socketio', io);

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Lắng nghe sự kiện join room để người dùng có thể tham gia vào phòng của chính họ
    socket.on('joinRoom', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined room: user_${userId}`);
    });

    // Xử lý khi client ngắt kết nối
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

module.exports = {
    server,
    io
};
