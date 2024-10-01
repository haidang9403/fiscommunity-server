
const { io } = require("socket.io-client");

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected to server:', socket.id);

    const userId = 2;
    socket.emit('joinRoom', userId);

    socket.on('newNotification', (data) => {
        console.log('New notification:', data.message);
    });
});



