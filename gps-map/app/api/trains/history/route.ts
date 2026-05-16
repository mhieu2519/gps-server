//../api/trains/history/route.ts
// API phục vụ tính năng "Xem lại hành trình". 
// lấy dữ liệu từ bảng lich_su_tau

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const selectedDate = searchParams.get('date');
    const client = await pool.connect();
    try {
        // Lấy tọa độ chi tiết của một Session cụ thể (để vẽ map)
        if (sessionId) {
            const res = await client.query(`
                SELECT 
                    ma_tau,
                    ST_AsGeoJSON(ST_MakeLine(geom ORDER BY timestamp ASC)) as path_json
                FROM lich_su_tau
                WHERE session_id = $1
                GROUP BY ma_tau
            `, [sessionId]);

            if (res.rows.length === 0 || !res.rows[0].path_json) {
                return NextResponse.json({ path: [] });
            }

            const geojson = JSON.parse(res.rows[0].path_json);
            // Chuyển đổi từ [lng, lat] của GeoJSON sang [lat, lng] của Leaflet
            const leafletPath = geojson.coordinates.map((coord: number[]) => [coord[1], coord[0]]);

            return NextResponse.json({
                ma_tau: res.rows[0].ma_tau,
                path: leafletPath
            });
        }

        // Lấy danh sách tổng hợp các Session (để hiện danh sách ở Sidebar)
        // Gom nhóm theo session_id để biết mỗi chuyến bắt đầu và kết thúc khi nào

        let sqlQuery = `
            SELECT 
                session_id, 
                ma_tau, 
                MIN(timestamp) as bat_dau, 
                MAX(timestamp) as ket_thuc,
                COUNT(*) as so_diem
            FROM lich_su_tau
        `;

        const queryParams = [];

        // Nếu có truyền ngày lên, thêm điều kiện WHERE
        if (selectedDate) {
            // Chuyển timestamp (bigint) thành Date để so sánh với chuỗi YYYY-MM-DD
            sqlQuery += ` WHERE TO_TIMESTAMP(timestamp)::date = $1::date `;
            queryParams.push(selectedDate);
        }

        sqlQuery += `
            GROUP BY session_id, ma_tau
            ORDER BY bat_dau DESC
            LIMIT 200
        `;

        const listRes = await client.query(sqlQuery, queryParams);
        return NextResponse.json(listRes.rows);

    } catch (err: any) {
        console.error("Lỗi API History:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        client.release();
    }
}