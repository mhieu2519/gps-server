// gps-server/socket-server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Redis = require('ioredis');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
app.use(express.static('public'));

const io = new Server(server, {
    cors: {
        origin: process.env.DOMAIN,
        methods: ["GET", "POST"],
        credentials: true
    }
});

const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

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

refreshActiveTrains();
setInterval(refreshActiveTrains, 30_000);

const SUB_CHANNEL = 'train_locations';

redis.subscribe(SUB_CHANNEL, (err, count) => {
    if (err) {
        console.error("❌ Redis Sub Error:", err.message);
    } else {
        console.log(`📡 Đã đăng ký nhận dữ liệu từ ${count} kênh.`);
    }
});

redis.on('message', async (channel, message) => {
    if (channel !== SUB_CHANNEL) return;

    try {
        const data = JSON.parse(message);

        if (!activeTrainSet.has(data.ma_tau)) {
            console.log(`⛔ Bỏ qua tàu chưa lập: ${data.ma_tau}`);
            return;
        }

        const lat = parseFloat(data.latitude || data.lat);
        const lng = parseFloat(data.longitude || data.lng);
        const speed = parseFloat(data.velocity || data.speed || 0);
        const heading = parseFloat(data.heading || 0);

        if (isNaN(lat) || isNaN(lng)) return;

        // ✅ Query đúng: xử lý MultiLineString + join ga để lấy ma_ga thực tế
        const geoQuery = `
            WITH project_train AS (
                SELECT 
                    id,
                    ten_tuyen,
                    geom,
                    ST_GeometryN(geom, 1) as single_line,
                    ST_Length(geom::geography) as total_len_meters,
                    ST_LineLocatePoint(
                        ST_GeometryN(geom, 1),
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)
                    ) as fraction
                FROM duong_ray
                ORDER BY geom::geography <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                LIMIT 1
            ),
            azimuth_calc AS (
                SELECT 
                    id as segment_id,
                    ten_tuyen,
                    total_len_meters,
                    fraction,
                    single_line,
                    DEGREES(ST_Azimuth(
                        ST_StartPoint(single_line),
                        ST_EndPoint(single_line)
                    )) as track_angle
                FROM project_train
            ),
            direction AS (
                SELECT 
                    segment_id,
                    ten_tuyen,
                    total_len_meters,
                    fraction,
                    single_line,
                    CASE 
                        WHEN ABS(track_angle - $3) < 90 OR ABS(track_angle - $3) > 270
                        THEN fraction
                        ELSE (1.0 - fraction)
                    END as real_progress_fraction,
                    CASE 
                        WHEN ABS(track_angle - $3) < 90 OR ABS(track_angle - $3) > 270
                        THEN true
                        ELSE false
                    END as is_forward
                FROM azimuth_calc
            )
            SELECT 
                d.segment_id,
                d.ten_tuyen,
                d.total_len_meters,
                d.fraction,
                d.real_progress_fraction,
                -- ✅ Lấy ma_ga thực tế từ bảng ga, tránh phụ thuộc vào tên ID đường ray
                CASE WHEN d.is_forward 
                    THEN g_end.ma_ga 
                    ELSE g_start.ma_ga 
                END as next_station_code
            FROM direction d
            LEFT JOIN LATERAL (
                SELECT ma_ga FROM ga
                ORDER BY ga.geom <-> ST_StartPoint(d.single_line)
                LIMIT 1
            ) g_start ON true
            LEFT JOIN LATERAL (
                SELECT ma_ga FROM ga
                ORDER BY ga.geom <-> ST_EndPoint(d.single_line)
                LIMIT 1
            ) g_end ON true;
        `;

        const geoResult = await pool.query(geoQuery, [lng, lat, heading]);

        if (geoResult.rows.length > 0) {
            const row = geoResult.rows[0];
            const totalLenMeters = parseFloat(row.total_len_meters);
            const progressFraction = parseFloat(row.real_progress_fraction);
            const distanceLeftMeters = totalLenMeters * (1.0 - progressFraction);

            let etaMinutes = -1;
            if (speed > 5) {
                const distanceLeftKm = distanceLeftMeters / 1000;
                etaMinutes = (distanceLeftKm / speed) * 60;
            }

            // ✅ Lấy thẳng từ query, không split ID nữa
            const nextStationCode = row.next_station_code || "";

            console.log(`🚉 Tàu ${data.ma_tau} → segment: ${row.segment_id} | next: ${nextStationCode} | progress: ${progressFraction.toFixed(3)}`);

            const enrichedData = {
                ...data,
                lat,
                lng,
                latitude: lat,
                longitude: lng,
                speed,
                heading,
                socketData: {
                    current_segment: row.segment_id,
                    next_station_code: nextStationCode,
                    segment_progress: progressFraction,
                    distance_left_meters: Math.max(0, distanceLeftMeters),
                    eta_minutes: etaMinutes,
                    is_at_station: speed < 3 && distanceLeftMeters < 150
                }
            };

            io.emit('train_update', enrichedData);

        } else {
            // Fallback: emit data thô nếu không tìm thấy đường ray
            io.emit('train_update', {
                ...data,
                lat,
                lng,
                latitude: lat,
                longitude: lng,
                speed,
                heading,
                socketData: null
            });
        }

    } catch (e) {
        console.error("❌ Lỗi xử lý:", e.message);
        // Fallback emit để tàu vẫn di chuyển dù PostGIS lỗi
        try {
            const raw = JSON.parse(message);
            const lat = parseFloat(raw.latitude || raw.lat);
            const lng = parseFloat(raw.longitude || raw.lng);
            if (!isNaN(lat) && !isNaN(lng) && activeTrainSet.has(raw.ma_tau)) {
                io.emit('train_update', {
                    ...raw,
                    lat,
                    lng,
                    latitude: lat,
                    longitude: lng,
                    speed: parseFloat(raw.velocity || raw.speed || 0),
                    heading: parseFloat(raw.heading || 0),
                    socketData: null
                });
            }
        } catch (_) { }
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 Client mới kết nối: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`❌ Client ngắt kết nối: ${socket.id}`);
    });
});

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
    console.log(`🚀 Socket.io Server đang chạy tại port ${PORT}...`);
});