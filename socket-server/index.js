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
        origin: process.env.DOMAIN,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Kết nối Redis (Dùng tên dịch vụ trong Docker)
// dùng cơ chế retry để tránh sập khi Redis khởi động chậm hơn Socket
const redis = new Redis(process.env.REDIS_URL, {
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
// Thay thế hoặc thêm đoạn xử lý route '/' trong socket-service (cổng 4000)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GPS Railway Gateway</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: #1e1e2f;
                    color: #ffffff;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    text-align: center;
                }
                .card {
                    background: #27293d;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                    max-width: 450px;
                    width: 90%;
                }
                .icon {
                    font-size: 50px;
                    margin-bottom: 20px;
                }
                h1 {
                    font-size: 24px;
                    margin-bottom: 10px;
                    color: #e14eca;
                }
                p {
                    color: #9a9a9a;
                    font-size: 15px;
                    line-height: 1.6;
                    margin-bottom: 30px;
                }
                .btn {
                    display: inline-block;
                    background: linear-gradient(to right, #e14eca, #ba54f5);
                    color: #ffffff;
                    text-decoration: none;
                    padding: 12px 30px;
                    border-radius: 25px;
                    font-weight: bold;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 15px rgba(225, 78, 202, 0.4);
                }
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(225, 78, 202, 0.6);
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">📡</div>
                <h1>Cổng Dịch Vụ Realtime</h1>
                <p>Bạn đang truy cập vào cổng dịch vụ Socket API chạy ngầm của hệ thống bản đồ đường sắt. Vui lòng quay lại trang chủ để xem bản đồ trực tuyến.</p>
                <a href="https://${process.env.DOMAIN}" class="btn">Quay về Trang Chủ Bản Đồ</a>
            </div>
        </body>
        </html>
    `);
});