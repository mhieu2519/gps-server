//app/api/trains/status/route.ts
//API để trang web lấy trạng thái toàn bộ tàu khi người dùng vừa mới load trang 
//để khởi tạo biến devices
import { NextResponse } from 'next/server';
import { db } from "@/lib/db";

export async function GET() {


    try {


        // Lấy dữ liệu và chuyển geom thành tọa độ X, Y
        const res = await db.query(`
    SELECT 
        t.ma_tau,
        t.lat,
        t.lng,
        t.speed,
        t.heading,
        t.battery,
        t.signal,
        t.timestamp,

        COALESCE(
            (
                SELECT json_agg(
                    json_build_object(
                        'ma_toa', ctlt.ma_toa,
                        'thu_tu_toa', ctlt.thu_tu_toa,
                        'so_luong_thuc_te', ctlt.so_luong_thuc_te
                    )
                    ORDER BY ctlt.thu_tu_toa
                )
                FROM chuyen_di cd
                JOIN chi_tiet_lap_tau ctlt
                    ON ctlt.ma_chuyen_di = cd.ma_chuyen_di
                WHERE cd.ma_tau_chay = t.ma_tau
                AND cd.trang_thai = 'dang_chay'
            ),
            '[]'
        ) AS danh_sach_toa

    FROM tau t
`);

        // Chuyển mảng kết quả thành Object Map (Key là ma_tau)
        const devices = res.rows.reduce((acc: any, row) => {
            acc[row.ma_tau] = {
                lat: row.lat,
                lng: row.lng,
                speed: row.speed,
                heading: row.heading,
                battery: row.battery,
                signal: row.signal,
                timestamp: Number(row.timestamp), //ép kiểu số do PostgreSQL BIGINT trả về string 
                danh_sach_toa: row.danh_sach_toa
            };
            return acc;
        }, {});

        return NextResponse.json(devices);
    } catch (err) {
        console.error("Lỗi API Status:", err);
        const error = err as Error;
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}