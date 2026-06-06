// index.js - Socket.io Server để phát dữ liệu thời gian thực từ Redis đến trình duyệt

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Redis = require('ioredis');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
app.use(express.static('public'));

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

// Kết nối PostgreSQL
// Kết nối Postgres
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
// Set chứa ma_tau đang có chuyến dang_chay
let activeTrainSet = new Set();

async function refreshActiveTrains() {
    try {
        const res = await pool.query(`
            SELECT ma_tau_chay
            FROM chuyen_di
            WHERE trang_thai = 'dang_chay'
              AND ma_tau_chay IS NOT NULL
        `);
        activeTrainSet = new Set(res.rows.map(r => r.ma_tau_chay));
        console.log(`🔄 Whitelist tàu hợp lệ: [${[...activeTrainSet].join(', ')}]`);
    } catch (err) {
        console.error("❌ Lỗi refresh whitelist tàu:", err.message);
    }
}

// Chạy ngay khi khởi động, sau đó refresh mỗi 30 giây
refreshActiveTrains();
setInterval(refreshActiveTrains, 30_000);


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
    if (channel !== SUB_CHANNEL) return;

    try {
        const data = JSON.parse(message);

        // ✅ Chỉ emit nếu tàu đang có chuyến dang_chay
        if (!activeTrainSet.has(data.ma_tau)) {
            console.log(`⛔ Bỏ qua tàu chưa lập: ${data.ma_tau}`);
            return;
        }

        io.emit('train_update', data);
    } catch (e) {
        console.error("❌ Lỗi parse JSON từ Redis:", e.message);
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 Client mới kết nối: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`❌ Client ngắt kết nối: ${socket.id}`);
    });
});



// Trang chủ đơn giản hướng dẫn người dùng
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GPS Tracking</title>
            <style>
                body { margin:0; padding:0; font-family:'Segoe UI',sans-serif; background:#1e1e2f; color:#fff; display:flex; justify-content:center; align-items:center; height:100vh; text-align:center; }
                .card { background:#27293d; padding:40px; border-radius:15px; box-shadow:0 8px 24px rgba(0,0,0,.3); max-width:450px; width:90%; }
                .icon { font-size:50px; margin-bottom:20px; }
                h1 { font-size:24px; margin-bottom:10px; color:#e14eca; }
                p { color:#9a9a9a; font-size:15px; line-height:1.6; margin-bottom:30px; }
                .btn { display:inline-block; background:linear-gradient(to right,#e14eca,#ba54f5); color:#fff; text-decoration:none; padding:12px 30px; border-radius:25px; font-weight:bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">📡</div>
                <h1>Cổng Dịch Vụ Realtime</h1>
                <p>Bạn đang truy cập vào cổng dịch vụ Socket API chạy ngầm của hệ thống bản đồ đường sắt.</p>
                <a href="https://${process.env.DOMAIN}" class="btn">Quay về Trang Chủ Bản Đồ</a>
            </div>
        </body>
        </html>
    `);
});

const PORT = 4000;
server.listen(PORT, () => {
    console.log(` Socket.io Server đang chạy tại port ${PORT}...`);
});