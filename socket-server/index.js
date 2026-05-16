// index.js - Socket.io Server để phát dữ liệu thời gian thực từ Redis đến trình duyệt

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Redis = require('ioredis');

const app = express();
const server = http.createServer(app);

// Khởi tạo Socket.io
const io = new Server(server, {
    cors: {
        origin: "https://gps-map.online", // Domain
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Kết nối Redis (Dùng tên dịch vụ trong Docker)
// dùng cơ chế retry để tránh sập khi Redis khởi động chậm hơn Socket
const redis = new Redis(process.env.REDIS_URL || 'redis://redis_cache:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

const SUB_CHANNEL = 'train_locations';

// Đăng ký kênh nhận tọa độ
redis.subscribe(SUB_CHANNEL, (err, count) => {
    if (err) {
        console.error("❌ Redis Sub Error:", err.message);
    } else {
        console.log(`📡 Đã đăng ký nhận dữ liệu từ ${count} kênh.`);
    }
});

// Khi có dữ liệu mới từ Redis, gửi tới Client
redis.on('message', (channel, message) => {
    if (channel === SUB_CHANNEL) {
        try {
            const data = JSON.parse(message);
            io.emit('train_update', data);
        } catch (e) {
            console.error("❌ Lỗi parse JSON từ Redis:", e.message);
        }
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 Client mới kết nối: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`❌ Client ngắt kết nối: ${socket.id}`);
    });
});


const PORT = 4000;
server.listen(PORT, () => {
    console.log(`🚀 Socket.io Server đang chạy tại port ${PORT}...`);
});