//app/api/trains/status/route.ts

import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,

    });

    try {
        await client.connect();

        // Lấy dữ liệu và chuyển geom thành tọa độ X, Y
        const res = await client.query(`
            SELECT 
                t.ma_tau, t.lat, t.lng, t.speed, t.heading, t.battery, t.signal, t.timestamp,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'ma_toa', o.ma_toa,
                        'loai_toa', o.loai_toa,
                        'kieu_cho', o.kieu_cho,
                        'tai_trong', o.tai_trong,
                        'suc_chua_toi_da', o.suc_chua_toi_da,
                        'don_vi', o.don_vi
                    )) 
                     FROM toa o 
                     WHERE o.ma_tau_so_huu = t.ma_tau
                    ), '[]'
                ) as danh_sach_toa
            FROM tau t
        `);

        // Chuyển mảng kết quả thành Object Map (Key là ma_tau) để khớp với Frontend cũ
        const devices = res.rows.reduce((acc: any, row) => {
            acc[row.ma_tau] = {
                lat: row.lat,
                lng: row.lng,
                speed: row.speed,
                heading: row.heading,
                battery: row.battery,
                signal: row.signal,
                timestamp: Number(row.timestamp), // PostgreSQL BIGINT trả về string nên cần ép kiểu số
                danh_sach_toa: row.danh_sach_toa
            };
            return acc;
        }, {});

        return NextResponse.json(devices);
    } catch (err) {
        console.error("Lỗi API Status:", err);
        const error = err as Error;
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        await client.end();
    }
}