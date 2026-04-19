import { PROXY_FILENAME } from 'next/dist/lib/constants';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Khởi tạo Pool để dùng lại kết nối, tối ưu cho việc update liên tục 5s/lần
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,

    ssl: {
        rejectUnauthorized: false // Cho phép kết nối nếu dùng chứng chỉ tự ký hoặc IP
    }
});

export async function POST(request: Request) {

    let client;
    try {
        const body = await request.json();
        const { ma_tau, lat, lng, speed, heading, battery, signal, danh_sach_toa } = body;

        // 1. Kiểm tra đầu vào
        if (!ma_tau || lat === undefined || lng === undefined) {
            return NextResponse.json({ error: "Thiếu tọa độ hoặc mã tàu" }, { status: 400 });
        }

        client = await pool.connect();
        await client.query('BEGIN'); // Bắt đầu Transaction

        const now = Math.floor(Date.now() / 1000);
        const TIMEOUT_SESSION = 30 * 60; // 30 phút để coi là một chuyến mới

        // 2. Tự động xác định Session ID
        // Tìm điểm cuối cùng của tàu này trong lịch sử
        const lastPointRes = await client.query(`
            SELECT session_id, timestamp, geom 
            FROM lich_su_tau 
            WHERE ma_tau = $1 
            ORDER BY timestamp DESC 
            LIMIT 1
        `, [ma_tau]);

        let currentSessionId = null;
        let shouldInsertHistory = true;

        if (lastPointRes.rows.length > 0) {
            const lastPoint = lastPointRes.rows[0];

            // Nếu thời gian gửi cách điểm cuối < 30 phút -> Dùng tiếp Session cũ
            if (now - Number(lastPoint.timestamp) < TIMEOUT_SESSION) {
                currentSessionId = lastPoint.session_id;

                // TỐI ƯU: Kiểm tra khoảng cách. Nếu tàu di chuyển < 5m thì không ghi lịch sử mới (tránh rác DB)
                const distRes = await client.query(`
                    SELECT ST_Distance(
                        $1::geography, 
                        $2::geography
                    ) as distance
                `, [lastPoint.geom, `SRID=4326;POINT(${lng} ${lat})`]);

                if (parseFloat(distRes.rows[0].distance) < 5) {
                    shouldInsertHistory = false;
                }
            }
        }

        // Nếu không có session cũ hoặc đã quá hạn -> Tạo Session ID mới theo timestamp
        if (!currentSessionId) {
            currentSessionId = `SESS_${ma_tau}_${now}`;
        }

        // 3. Cập nhật vị trí tức thời (Bảng tau)
        await client.query(`
            INSERT INTO tau (ma_tau, lat, lng, speed, heading, battery, signal, timestamp, geom)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($3, $2), 4326))
            ON CONFLICT (ma_tau) 
            DO UPDATE SET 
                lat = EXCLUDED.lat, lng = EXCLUDED.lng, speed = EXCLUDED.speed, 
                heading = EXCLUDED.heading, battery = EXCLUDED.battery, 
                signal = EXCLUDED.signal, timestamp = EXCLUDED.timestamp, geom = EXCLUDED.geom;
        `, [ma_tau, lat, lng, speed, heading, battery, signal, now]);

        // 4. Ghi lịch sử hành trình (Nếu có di chuyển đáng kể)
        if (shouldInsertHistory) {
            await client.query(`
                INSERT INTO lich_su_tau (ma_tau, lat, lng, timestamp, session_id, geom)
                VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($3, $2), 4326));
            `, [ma_tau, lat, lng, now, currentSessionId]);
        }

        // 5. Cập nhật thông tin toa (Chỉ cập nhật nếu có gửi kèm)
        if (danh_sach_toa && Array.isArray(danh_sach_toa)) {
            for (const toa of danh_sach_toa) {
                await client.query(`
                    INSERT INTO toa (ma_toa, loai_toa, kieu_cho, tai_trong, don_vi, ma_tau_so_huu)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (ma_toa) 
                    DO UPDATE SET tai_trong = EXCLUDED.tai_trong, ma_tau_so_huu = EXCLUDED.ma_tau_so_huu;
                `, [toa.ma_toa, toa.loai_toa, toa.kieu_cho, toa.tai_trong, toa.don_vi, ma_tau]);
            }
        }

        await client.query('COMMIT'); // Hoàn tất mọi thay đổi
        return NextResponse.json({
            success: true,
            session_id: currentSessionId,
            recorded: shouldInsertHistory
        });

    } catch (err: any) {
        if (client) await client.query('ROLLBACK'); // Lỗi thì trả dữ liệu về trạng thái cũ
        console.error("Lỗi Update API:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        if (client) client.release(); // Quan trọng: Luôn giải phóng kết nối về Pool
    }
}