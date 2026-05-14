const io = require('socket.io')(4000, {
    cors: { origin: "*" } // Cho phép Next.js truy cập
});
const Redis = require('ioredis');

// Kết nối Redis (Dùng tên dịch vụ trong Docker)
const redis = new Redis(process.env.REDIS_URL || 'redis://redis_cache:6379');

// Đăng ký kênh nhận tọa độ
const SUB_CHANNEL = 'train_locations';
redis.subscribe(SUB_CHANNEL, (err, count) => {
    if (err) console.error("❌ Redis Sub Error:", err);
    console.log(`📡 Đã đăng ký nhận dữ liệu từ ${count} kênh.`);
});

// Khi có dữ liệu mới từ Redis, phát ngay tới Client
redis.on('message', (channel, message) => {
    if (channel === SUB_CHANNEL) {
        const data = JSON.parse(message);
        io.emit('train_update', data); // Phát tới toàn bộ trình duyệt đang mở
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 Client mới kết nối: ${socket.id}`);
});

console.log("🚀 Socket.io Server đang chạy tại port 4000...");