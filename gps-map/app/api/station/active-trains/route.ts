// gps-map/app/api/station/active-trains/route.ts
//
// API này chỉ dành cho role "supervisor".
// Flow:
//    Lấy session → ma_ga của tài khoản
//    Query bảng `ga` lấy tọa độ trung tâm ga (ST_Centroid)
//    Query bảng `tau` lấy tất cả tàu đang có tọa độ
//    Tính khoảng cách Haversine, lọc tàu trong bán kính DETECTION_RADIUS_M
//    Với mỗi tàu trong bán kính: join chuyen_di → chi_tiet_lap_tau → lấy danh sách toa
//    Trả về { isWindowOpen, windowClosesAt, trains: [...] }
//
// Cửa sổ cập nhật:
//   - Mở khi có ít nhất 1 tàu trong bán kính
//   - Đóng WINDOW_GRACE_MS (3 phút) sau khi tàu cuối rời bán kính
//   - Trạng thái cửa sổ được lưu tạm trong bảng `station_window_state`
//     (tạo bên dưới) để tránh mất trạng thái khi trang reload

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

const DETECTION_RADIUS_M = 200;   // bán kính phát hiện tàu vào ga (mét)
const WINDOW_GRACE_MS = 3 * 60 * 1000; // 3 phút sau khi tàu rời ga

/* Công thức Haversine – trả về khoảng cách giữa 2 điểm tọa độ (mét) */
function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET() {
    // Kiểm tra quyền supervisor 
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const role = (session.user as any).role;
    const username = session.user?.name;
    if (role !== "supervisor" && role !== "admin") {
        return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    try {
        //  Lấy ma_ga, tọa độ ga của tài khoản này 
        const accountRes = await db.query(
            `SELECT tk.ma_ga, ST_Y(ST_Centroid(g.geom)) AS lat, ST_X(ST_Centroid(g.geom)) AS lng, g.ten_ga
             FROM tai_khoan tk
             JOIN ga g ON g.ma_ga = tk.ma_ga
             WHERE tk.ten_dang_nhap = $1`,
            [username]
        );
        // Admin không có ma_ga → dùng ga đầu tiên có tàu, hoặc cho chọn
        const isAdmin = role === "admin";

        let ma_ga: string, gaLat: number, gaLng: number, ten_ga: string;

        if (accountRes.rows.length === 0 || !accountRes.rows[0].ma_ga) {
            if (!isAdmin) {
                return NextResponse.json(
                    { error: "Tài khoản chưa được gán ga hoặc ga không tồn tại." },
                    { status: 400 }
                );
            }
            // Admin không có ma_ga → lấy ga đầu tiên trong DB để làm điểm tham chiếu mặc định
            const defaultGaRes = await db.query(
                `SELECT ma_ga, ten_ga, ST_Y(ST_Centroid(geom)) AS lat, ST_X(ST_Centroid(geom)) AS lng
         FROM ga WHERE geom IS NOT NULL LIMIT 1`
            );
            if (defaultGaRes.rows.length === 0) {
                return NextResponse.json({ error: "Không có ga nào trong hệ thống." }, { status: 400 });
            }
            ({ ma_ga, ten_ga, lat: gaLat, lng: gaLng } = defaultGaRes.rows[0]);
        } else {
            ({ ma_ga, ten_ga, lat: gaLat, lng: gaLng } = accountRes.rows[0]);
            if (!gaLat || !gaLng) {
                return NextResponse.json(
                    { error: "Ga chưa có tọa độ trong hệ thống." },
                    { status: 400 }
                );
            }
        }

        // Lấy toàn bộ tàu đang có tọa độ 
        const tauRes = await db.query(
            `SELECT ma_tau, lat, lng, speed, timestamp FROM tau WHERE lat IS NOT NULL AND lng IS NOT NULL`
        );

        // Lọc tàu trong bán kính DETECTION_RADIUS_M 
        const trainsInRadius: string[] = [];

        if (isAdmin && !accountRes.rows[0]?.ma_ga) {
            // Admin không gắn ga → hiển thị TẤT CẢ tàu đang có tọa độ
            for (const row of tauRes.rows) {
                trainsInRadius.push(row.ma_tau);
            }
        } else {
            for (const row of tauRes.rows) {
                const dist = haversineDistance(gaLat, gaLng, Number(row.lat), Number(row.lng));
                if (!isAdmin || accountRes.rows[0]?.ma_ga) {
                    if (dist > DETECTION_RADIUS_M) continue;
                }
                if (dist <= DETECTION_RADIUS_M) {
                    trainsInRadius.push(row.ma_tau);
                }
            }
        }

        //  Quản lý trạng thái cửa sổ 
        //   Đảm bảo bảng tồn tại (idempotent)
        await db.query(`
            CREATE TABLE IF NOT EXISTS station_window_state (
                ma_ga          VARCHAR PRIMARY KEY,
                last_train_in  TIMESTAMPTZ,   -- lần cuối có tàu trong bán kính
                window_closes  TIMESTAMPTZ    -- thời điểm cửa sổ sẽ đóng
            )
        `);

        const now = new Date();
        let isWindowOpen = false;
        let windowClosesAt: Date | null = null;

        if (trainsInRadius.length > 0) {
            // Có tàu trong bán kính → mở cửa sổ / gia hạn
            const closesAt = new Date(now.getTime() + WINDOW_GRACE_MS);
            await db.query(
                `INSERT INTO station_window_state (ma_ga, last_train_in, window_closes)
                 VALUES ($1, NOW(), $2)
                 ON CONFLICT (ma_ga) DO UPDATE
                    SET last_train_in = NOW(),
                        window_closes  = $2`,
                [ma_ga, closesAt]
            );
            isWindowOpen = true;
            windowClosesAt = closesAt;
        } else {
            // Không có tàu → kiểm tra còn trong thời gian ân hạn không
            const stateRes = await db.query(
                `SELECT window_closes FROM station_window_state WHERE ma_ga = $1`,
                [ma_ga]
            );
            if (stateRes.rows.length > 0) {
                const closes: Date = new Date(stateRes.rows[0].window_closes);
                if (closes > now) {
                    isWindowOpen = true;
                    windowClosesAt = closes;
                }
            }
        }

        // Lấy chi tiết các tàu đang dừng (nếu cửa sổ mở)
        interface TrainInfo {
            ma_tau: string;
            lat: number;
            lng: number;
            speed: number;
            distance_m: number;
            ma_chuyen_di: string | null;
            carriages: CarriageInfo[];
        }
        interface CarriageInfo {
            ma_toa: string;
            thu_tu_toa: number;
            loai_toa: string;
            so_luong_thuc_te: number;
            khoi_luong_thuc_te: number;
            trang_thai: string;
            ghi_chu: string;
        }

        const trains: TrainInfo[] = [];

        for (const row of tauRes.rows) {
            const dist = haversineDistance(gaLat, gaLng, Number(row.lat), Number(row.lng));
            if (dist > DETECTION_RADIUS_M) continue;

            // Lấy chuyến đi đang chạy của tàu này
            const tripRes = await db.query(
                `SELECT cd.ma_chuyen_di
                 FROM chuyen_di cd
                 WHERE cd.ma_tau_chay = $1 AND cd.trang_thai = 'dang_chay'
                 LIMIT 1`,
                [row.ma_tau]
            );
            const ma_chuyen_di = tripRes.rows[0]?.ma_chuyen_di ?? null;

            // Lấy danh sách toa kèm dữ liệu cập nhật hiện tại
            let carriages: CarriageInfo[] = [];
            if (ma_chuyen_di) {
                const toaRes = await db.query(
                    `SELECT
                        clt.ma_toa,
                        clt.thu_tu_toa,
                        COALESCE(t.loai_toa, 'KH_NGOI') AS loai_toa,
                        COALESCE(clt.so_luong_thuc_te, 0) AS so_luong_thuc_te,
                        COALESCE(su.khoi_luong_thuc_te, 0) AS khoi_luong_thuc_te,
                        COALESCE(su.trang_thai_toa, 'binh_thuong') AS trang_thai,
                        COALESCE(su.ghi_chu, '') AS ghi_chu
                     FROM chi_tiet_lap_tau clt
                     LEFT JOIN public.toa t ON t.ma_toa = clt.ma_toa
                     LEFT JOIN station_update_log su
                        ON su.ma_toa = clt.ma_toa
                        AND su.ma_chuyen_di = clt.ma_chuyen_di
                        AND su.ma_ga = $1
                        -- lấy bản ghi mới nhất trong cùng chuyến đi tại ga này
                        AND su.created_at = (
                            SELECT MAX(s2.created_at)
                            FROM station_update_log s2
                            WHERE s2.ma_toa = clt.ma_toa
                              AND s2.ma_chuyen_di = clt.ma_chuyen_di
                              AND s2.ma_ga = $1
                        )
                     WHERE clt.ma_chuyen_di = $2
                     ORDER BY clt.thu_tu_toa ASC`,
                    [ma_ga, ma_chuyen_di]
                );
                carriages = toaRes.rows;
            }

            trains.push({
                ma_tau: row.ma_tau,
                lat: Number(row.lat),
                lng: Number(row.lng),
                speed: Number(row.speed ?? 0),
                distance_m: Math.round(dist),
                ma_chuyen_di,
                carriages,
            });
        }

        return NextResponse.json({
            ma_ga,
            ten_ga,
            ga_lat: gaLat,
            ga_lng: gaLng,
            detection_radius_m: DETECTION_RADIUS_M,
            window_grace_minutes: WINDOW_GRACE_MS / 60000,
            isWindowOpen,
            windowClosesAt: windowClosesAt?.toISOString() ?? null,
            trains,
        });
    } catch (error: any) {
        console.error("❌ Lỗi API station/active-trains:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
