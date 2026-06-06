// gps-map/app/api/station/active-trains/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

const DETECTION_RADIUS_M = 200;
const WINDOW_GRACE_MS = 3 * 60 * 1000;

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

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const role = (session.user as any).role;
    const username = session.user?.name;

    if (role !== "supervisor" && role !== "admin") {
        return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const isAdmin = role === "admin";

    try {
        // Lấy thông tin tài khoản + ga (nếu có)
        const accountRes = await db.query(
            `SELECT tk.ma_ga, ST_Y(ST_Centroid(g.geom)) AS lat, ST_X(ST_Centroid(g.geom)) AS lng, g.ten_ga
             FROM tai_khoan tk
             LEFT JOIN ga g ON g.ma_ga = tk.ma_ga
             WHERE tk.ten_dang_nhap = $1`,
            [username]
        );

        const accountRow = accountRes.rows[0];
        const hasMaGa = accountRow?.ma_ga != null;

        // Supervisor bắt buộc phải có ma_ga
        if (!isAdmin && !hasMaGa) {
            return NextResponse.json(
                { error: "Tài khoản chưa được gán ga hoặc ga không tồn tại." },
                { status: 400 }
            );
        }

        // Admin không có ma_ga → chế độ "xem tất cả ga"
        const isGlobalAdmin = isAdmin && !hasMaGa;

        let ma_ga: string;
        let gaLat: number;
        let gaLng: number;
        let ten_ga: string;

        if (isGlobalAdmin) {
            // Dùng ga đầu tiên làm tham chiếu cho window_state (không ảnh hưởng filter tàu)
            const anyGaRes = await db.query(
                `SELECT ma_ga, ten_ga,
                        ST_Y(ST_Centroid(geom)) AS lat,
                        ST_X(ST_Centroid(geom)) AS lng
                 FROM ga WHERE geom IS NOT NULL LIMIT 1`
            );
            if (anyGaRes.rows.length === 0) {
                return NextResponse.json({ error: "Không có ga nào trong hệ thống." }, { status: 400 });
            }
            ma_ga = anyGaRes.rows[0].ma_ga;
            gaLat = Number(anyGaRes.rows[0].lat);
            gaLng = Number(anyGaRes.rows[0].lng);
            ten_ga = "Tất cả các ga (Admin)";
        } else {
            if (!accountRow?.lat || !accountRow?.lng) {
                return NextResponse.json(
                    { error: "Ga chưa có tọa độ trong hệ thống." },
                    { status: 400 }
                );
            }
            ma_ga = accountRow.ma_ga;
            gaLat = Number(accountRow.lat);
            gaLng = Number(accountRow.lng);
            ten_ga = accountRow.ten_ga;
        }

        // Lấy toàn bộ tàu đang có tọa độ
        const tauRes = await db.query(
            `SELECT ma_tau, lat, lng, speed, timestamp FROM tau WHERE lat IS NOT NULL AND lng IS NOT NULL`
        );

        // Lọc tàu theo bán kính (supervisor) hoặc lấy tất cả (admin global)
        const trainsInRadius: string[] = [];
        for (const row of tauRes.rows) {
            if (isGlobalAdmin) {
                // Admin không gắn ga → thấy tất cả tàu, không giới hạn bán kính
                trainsInRadius.push(row.ma_tau);
            } else {
                const dist = haversineDistance(gaLat, gaLng, Number(row.lat), Number(row.lng));
                if (dist <= DETECTION_RADIUS_M) {
                    trainsInRadius.push(row.ma_tau);
                }
            }
        }

        // Quản lý trạng thái cửa sổ
        await db.query(`
            CREATE TABLE IF NOT EXISTS station_window_state (
                ma_ga          VARCHAR PRIMARY KEY,
                last_train_in  TIMESTAMPTZ,
                window_closes  TIMESTAMPTZ
            )
        `);

        const now = new Date();
        let isWindowOpen = false;
        let windowClosesAt: Date | null = null;

        if (isGlobalAdmin) {
            // Admin global: cửa sổ LUÔN MỞ, không giới hạn thời gian
            isWindowOpen = true;
            windowClosesAt = null; // ← không 
            // có countdown cho admin
        } else {
            if (trainsInRadius.length > 0) {
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
        }

        // Lấy chi tiết các tàu
        interface TrainInfo {
            ma_tau: string;
            lat: number;
            lng: number;
            speed: number;
            distance_m: number;
            ma_chuyen_di: string | null;
            ten_ga_gan_nhat?: string | null;
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
        const nearestGaMap: Record<string, string> = {};
        if (isGlobalAdmin && trainsInRadius.length > 0) {
            for (const row of tauRes.rows) {
                if (!trainsInRadius.includes(row.ma_tau)) continue;
                const nearestGaRes = await db.query(
                    `SELECT ten_ga,
                            ROUND(ST_Distance(
                                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                                ST_Centroid(geom)::geography
                            )) AS dist_m
                     FROM ga
                     WHERE geom IS NOT NULL
                     ORDER BY dist_m ASC
                     LIMIT 1`,
                    [Number(row.lng), Number(row.lat)]
                );
                if (nearestGaRes.rows.length > 0) {
                    nearestGaMap[row.ma_tau] = `${nearestGaRes.rows[0].ten_ga} (~${nearestGaRes.rows[0].dist_m}m)`;
                }
            }
        }

        for (const row of tauRes.rows) {
            if (!trainsInRadius.includes(row.ma_tau)) continue;

            const dist = isGlobalAdmin
                ? 0
                : Math.round(haversineDistance(gaLat, gaLng, Number(row.lat), Number(row.lng)));
            // Với admin global, tìm ga gần nhất của mỗi tàu
            const tenGaGanNhat = isGlobalAdmin ? (nearestGaMap[row.ma_tau] ?? null) : null;
            /*
             if (isGlobalAdmin) {
                 const nearestGaRes = await db.query(
                     `SELECT ten_ga,
                             ROUND(ST_Distance(
                                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                                 ST_Centroid(geom)::geography
                             )) AS dist_m
                      FROM ga
                      WHERE geom IS NOT NULL
                      ORDER BY dist_m ASC
                      LIMIT 1`,
                     [Number(row.lng), Number(row.lat)]
                 );
                 if (nearestGaRes.rows.length > 0) {
                     tenGaGanNhat = `${nearestGaRes.rows[0].ten_ga} (~${nearestGaRes.rows[0].dist_m}m)`;
                 }
             }
 */
            // Lấy chuyến đi đang chạy
            const tripRes = await db.query(
                `SELECT cd.ma_chuyen_di
                 FROM chuyen_di cd
                 WHERE cd.ma_tau_chay = $1 AND cd.trang_thai = 'dang_chay'
                 LIMIT 1`,
                [row.ma_tau]
            );
            const ma_chuyen_di = tripRes.rows[0]?.ma_chuyen_di ?? null;

            // Lấy danh sách toa - admin dùng ma_ga của ga tham chiếu để log
            let carriages: CarriageInfo[] = [];
            if (ma_chuyen_di) {
                const logMaGa = isGlobalAdmin ? ma_ga : ma_ga;
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
                        AND su.created_at = (
                            SELECT MAX(s2.created_at)
                            FROM station_update_log s2
                            WHERE s2.ma_toa = clt.ma_toa
                              AND s2.ma_chuyen_di = clt.ma_chuyen_di
                              AND s2.ma_ga = $1
                        )
                     WHERE clt.ma_chuyen_di = $2
                     ORDER BY clt.thu_tu_toa ASC`,
                    [logMaGa, ma_chuyen_di]
                );
                carriages = toaRes.rows;
            }

            trains.push({
                ma_tau: row.ma_tau,
                lat: Number(row.lat),
                lng: Number(row.lng),
                speed: Number(row.speed ?? 0),
                distance_m: dist,
                ma_chuyen_di,
                ten_ga_gan_nhat: tenGaGanNhat,
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
            is_global_admin: isGlobalAdmin,
            trains,
        });

    } catch (error: any) {
        console.error("❌ Lỗi API station/active-trains:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}