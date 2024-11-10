const app = require("../../app");
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const prisma = require("./prisma");
const { FriendRequestStatus } = require("@prisma/client");

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set('socketio', io);

const onlineUsers = new Map();

const getFriends = async (userId) => {
    const user = await prisma.user.findUnique({
        where: {
            id: parseInt(userId),
        },
        include: {
            sendRelations: true,
            reciveRelations: true,
            conversations: {
                include: {
                    user: true
                }
            }
        }
    });

    const conversationNotGroup = user.conversations.filter((conversation) => !conversation.isGroup)

    const otherUsers = conversationNotGroup.map((e) => {
        const otherUser = e.user.filter((user) => user.id != userId)
        return otherUser[0]
    })

    return otherUsers
}

io.on('connection', async (socket) => {
    console.log(`New client connected: ${socket.id}`);

    const userId = socket.handshake.query.userId;

    onlineUsers.set(userId, true);

    socket.join(`user_${userId}`);
    const friends = await getFriends(userId);

    friends.forEach(friend => {
        const isFriendOnline = onlineUsers.get(friend.id.toString());

        socket.emit("updateUserStatus", { userId: friend.id, isActive: !!isFriendOnline });

        io.to(`user_${friend.id}`).emit('updateUserStatus', { userId, isActive: true });
    });

    console.log(`User ${userId} is online`);

    // Xử lý khi client ngắt kết nối
    socket.on('disconnect', () => {
        onlineUsers.delete(userId);
        friends.forEach(friend => {
            const isFriendOnline = onlineUsers.get(friend.id.toString());

            socket.emit("updateUserStatus", { userId: friend.id, isActive: !!isFriendOnline });

            io.to(`user_${friend.id}`).emit('updateUserStatus', { userId, isActive: false });
        });
        console.log(`User ${userId} is offline`);
    });
});

module.exports = {
    server,
    io
};
