const createError = require("http-errors");
const config = require("../config");
const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");
const User = require("../models/users/user.model");
const prisma = require("../services/prisma");

const LIVEKIT_API_KEY = config.liveKit.api_key;
const LIVEKIT_SECRET = config.liveKit.api_secret;
const LIVEKIT_URL = config.liveKit.url;

const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_SECRET);

function formatCallDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return h > 0
        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const callController = {
    // Join room chat call
    joinRoom: async (req, res, next) => {
        const { conversationId } = req.body; // chatId là ID đoạn chat, userId là ID người gọi
        const userId = req.payload.aud;

        if (!conversationId) {
            return next(createError(400, "Missing conversationId!"))
        }

        try {
            // Get user
            const user = await User.model.findUnique({
                where: {
                    id: parseInt(userId)
                },
                include: {
                    userProfile: true
                }
            })

            // Kiểm tra xem room đã tồn tại chưa
            const rooms = await roomService.listRooms();
            let existingRoom = rooms.find((room) => room.name === conversationId);

            // Nếu chưa có room, tạo mới
            if (!existingRoom) {
                const start = JSON.stringify(Date.now());
                await roomService.createRoom({ name: String(conversationId), emptyTimeout: 300, metadata: start });
            }

            // Tạo token để user tham gia vào room
            const token = new AccessToken(
                LIVEKIT_API_KEY, 
                LIVEKIT_SECRET, 
                { 
                    identity: String(userId), 
                    name: String(user.userProfile.fullname), 
                    metadata: JSON.stringify(user.userProfile),
                });
            token.addGrant({ roomJoin: true, room: String(conversationId), canPublish: true, canSubscribe: true, canPublishData: true});
            const now = Math.floor(Date.now() / 1000); // Timestamp hiện tạ
            token.ttl = now + 3600;
            const tonkenJWT = await token.toJwt()

            return res.json({ room: String(conversationId), token: tonkenJWT, url: LIVEKIT_URL });
        } catch (error) {
            console.log(error)
            next(createError(500))
        }
    },
    // Delete room
    // Check room
    // Get list room active
    getRoom: async (req, res, next) => {
        try {
            const userId = req.payload.aud;
            const conversations = await prisma.conversation.findMany({
                where: {
                    user: {
                        some: {
                            id: parseInt(userId)
                        }
                    }
                },
                include: {
                    user: {
                        include: {
                            userProfile: true
                        }
                    }
                }
            })

            const rooms = await roomService.listRooms();

            const roomActive = await Promise.all(
                rooms
                    .filter((room) =>
                        conversations.some(
                            (conversation) => parseInt(conversation.id) === parseInt(room.name)
                        )
                    )
                    .map(async (room) => {
                        const memberCallingInfo = await roomService.listParticipants(room.name); // Lấy thông tin chi tiết phòng
                        const conversationInfo = conversations.find((conversation) => conversation.id == room.name);

                        if (!conversationInfo) {
                            return null; // Trả về null nếu không tìm thấy thông tin hội thoại
                        }

                        console.log(room)

                        const isCalling = memberCallingInfo.some((member) => String(member.identity) === String(userId));

                        return {
                            nameRoom: room.name,
                            nameConversation: conversationInfo.name,
                            numMemberCalls: memberCallingInfo.length, // Số lượng người đang tham gia
                            members: conversationInfo.user,
                            isCalling,
                            isGroup: conversationInfo.isGroup,
                            metadata: room.metadata
                        };
                    })
            );

            // Lọc ra những giá trị null (các object rỗng hoặc không hợp lệ)
            const validRoomActive = roomActive.filter(room => room !== null).filter(room => room.numMemberCalls > 0);

            res.status(201).json(validRoomActive);

        } catch (e) {
            console.log(e);
            next(createError(500, "Error when get list calling room"))
        }
    },
    // Disconnect room
    disconnectRoom: async (req, res, next) => {
        const { conversationId } = req.body;
        const userId = req.payload.aud;

        if (!conversationId) {
            return next(createError(400, "Missing conversationId!"))
        }

        try {
            const rooms = await roomService.listRooms();
            const existingRoom = rooms.find((room) => room.name === conversationId);

            if (!existingRoom) {
                return next(createError(404, "Room not found!"))
            }

            if(existingRoom.numParticipants === 0) {
                
                const startTime = new Date(JSON.parse(existingRoom.metadata));
                const endTime = Date.now();
                const durationInSeconds = Math.floor((endTime - startTime) / 1000);
                await roomService.deleteRoom(conversationId);
                await prisma.message.create({
                    data: {
                        conversationId: parseInt(conversationId),
                        senderId: parseInt(userId),
                        body: formatCallDuration(durationInSeconds),
                        type: "HISTORY_CALL",
                        seens: { connect: { id: parseInt(userId) }}
                    } 
                })
                return res.json({ message: "Room deleted!" });
            }

            return res.json({ message: "Disconnect room successfully!" });
        } catch (error) {
            console.log(error)
            next(createError(500))
        }
    },
}

module.exports = callController