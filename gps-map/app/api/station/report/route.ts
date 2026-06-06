// gps-map/app/api/station/report/route.ts
//
// Supervisor gửi bản tin cập nhật sau khi tàu dừng tại ga.
// Dữ liệu được ghi vào bảng `station_update_log` (bảng lịch sử, không ghi đè).
// Đồng thời cập nhật `chi_tiet_lap_tau.so_luong_thuc_te` cho toa khách
// và `du_lieu_tau_hang.khoi_luong_thuc_te` cho toa hàng.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

interface CarriageUpdate {
    ma_toa: string;
    loai_toa: "KH_NGOI" | "KH_NAM" | "HANG_HOA";
    so_luong_thuc_te?: number;    // cho toa khách
    khoi_luong_thuc_te?: number;  // cho toa hàng
    trang_thai_toa: "binh_thuong" | "hong_nhe" | "hong_nang" | "ngung_hoat_dong";
    ghi_chu?: string;
}

export async function POST(request: Request) {
    //  Kiểm tra quyền 
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
        const body = await request.json();
        const { ma_chuyen_di, ma_tau, carriages } = body as {
            ma_chuyen_di: string;
            ma_tau: string;
            carriages: CarriageUpdate[];
        };

        if (!ma_chuyen_di || !ma_tau || !Array.isArray(carriages) || carriages.length === 0) {
            return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
        }

        //  Lấy ma_ga của supervisor
        const accountRes = await db.query(
            `SELECT ma_ga FROM tai_khoan WHERE ten_dang_nhap = $1`,
            [username]
        );
        if (accountRes.rows.length === 0 || !accountRes.rows[0].ma_ga) {
            return NextResponse.json({ error: "Tài khoản chưa được gán ga" }, { status: 400 });
        }
        const ma_ga: string = accountRes.rows[0].ma_ga;

        //  Xác nhận cửa sổ còn mở (admin bỏ qua kiểm tra này)
        const now = new Date();
        if (role !== "admin") {
            const windowRes = await db.query(
                `SELECT window_closes FROM station_window_state WHERE ma_ga = $1`,
                [ma_ga]
            );
            if (windowRes.rows.length === 0 || new Date(windowRes.rows[0].window_closes) <= now) {
                return NextResponse.json(
                    { error: "Cửa sổ cập nhật đã đóng. Tàu không còn trong ga." },
                    { status: 403 }
                );
            }
        }

        //  Đảm bảo bảng log tồn tại 
        await db.query(`
            CREATE TABLE IF NOT EXISTS station_update_log (
                id                 SERIAL PRIMARY KEY,
                ma_ga              VARCHAR NOT NULL,
                ma_chuyen_di       VARCHAR NOT NULL,
                ma_toa             VARCHAR NOT NULL,
                loai_toa           VARCHAR,
                so_luong_thuc_te   INTEGER,
                khoi_luong_thuc_te NUMERIC(10,2),
                trang_thai_toa     VARCHAR DEFAULT 'binh_thuong',
                ghi_chu            TEXT,
                ten_dang_nhap      VARCHAR,
                created_at         TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        const client = await db.connect();
        try {
            await client.query("BEGIN");

            for (const c of carriages) {
                const soLuong = c.so_luong_thuc_te ?? null;
                const khoiLuong = c.khoi_luong_thuc_te ?? null;
                const trangThai = c.trang_thai_toa ?? "binh_thuong";
                const ghiChu = c.ghi_chu ?? "";

                //  Ghi log (lịch sử, không ghi đè)
                await client.query(
                    `INSERT INTO station_update_log
                        (ma_ga, ma_chuyen_di, ma_toa, loai_toa, so_luong_thuc_te, khoi_luong_thuc_te, trang_thai_toa, ghi_chu, ten_dang_nhap)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [ma_ga, ma_chuyen_di, c.ma_toa, c.loai_toa, soLuong, khoiLuong, trangThai, ghiChu, username]
                );

                //  Cập nhật số liệu thực tế vào bảng vận hành
                if (c.loai_toa === "HANG_HOA" && khoiLuong !== null) {
                    await client.query(
                        `UPDATE du_lieu_tau_hang SET khoi_luong_thuc_te = $1 WHERE ma_toa = $2`,
                        [khoiLuong, c.ma_toa]
                    );
                } else if (soLuong !== null) {
                    await client.query(
                        `UPDATE chi_tiet_lap_tau SET so_luong_thuc_te = $1
                         WHERE ma_toa = $2 AND ma_chuyen_di = $3`,
                        [soLuong, c.ma_toa, ma_chuyen_di]
                    );
                }

                // Nếu toa hỏng nặng/ngừng hoạt động → cập nhật is_active = false
                if (trangThai === "hong_nang" || trangThai === "ngung_hoat_dong") {
                    await client.query(
                        `UPDATE chi_tiet_lap_tau SET is_active = false
                         WHERE ma_toa = $1 AND ma_chuyen_di = $2`,
                        [c.ma_toa, ma_chuyen_di]
                    );
                }
            }

            await client.query("COMMIT");
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }

        return NextResponse.json({
            success: true,
            message: `Đã ghi nhận ${carriages.length} toa tàu cho chuyến ${ma_chuyen_di} tại ga ${ma_ga}.`,
        });
    } catch (error: any) {
        console.error("❌ Lỗi API station/report:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
