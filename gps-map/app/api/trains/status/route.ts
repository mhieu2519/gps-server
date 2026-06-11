//app/api/trains/status/route.ts
//API để trang web lấy trạng thái toàn bộ tàu khi người dùng vừa mới load trang 
//để khởi tạo biến devices
//Đồng thời, API này cũng trả về chi tiết danh sách toa tàu và danh sách ga chi tiết đã đối chiếu để Map.tsx nhận diện hiển thị trên bản đồ
import { NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { DeviceStatus } from "@/components/Map/types";


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
        t.vibration,
        t.alert,
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
        ) AS danh_sach_toa,

         -- Phục vụ bài toán lộ trình: Đối chiếu mảng mã ga lộ trình sang bảng 'ga' để lấy chi tiết tọa độ
        COALESCE(
            (
                SELECT json_agg(
                    json_build_object(
                        'ma_ga', g.ma_ga,
                        'ten_ga', g.ten_ga,
                        'lat', ST_Y(ST_Centroid(g.geom)), -- Trích xuất Vĩ độ từ cột PostGIS geom
                        'lng', ST_X(ST_Centroid(g.geom))  -- Trích xuất Kinh độ từ cột PostGIS geom
                    )
                    ORDER BY ga_st.thu_tu_ga ASC -- Đảm bảo ga xếp đúng thứ tự hành trình đi
                )
                FROM chuyen_di cd
                JOIN lo_trinh lt ON cd.ma_lo_trinh = lt.ma_lo_trinh
                -- unnest rải mảng mã ga kết hợp WITH ORDINALITY để đánh số thứ tự (thu_tu_ga) tự động
                CROSS JOIN LATERAL unnest(lt.danh_sach_ga) WITH ORDINALITY AS ga_st(ma_ga, thu_tu_ga)
                JOIN ga g ON g.ma_ga::text = ga_st.ma_ga::text
                WHERE cd.ma_tau_chay = t.ma_tau
                AND cd.trang_thai = 'dang_chay'
            ),
            '[]'
        ) AS danh_sach_ga_chi_tiet

    FROM tau t
    -- ✅ Chỉ lấy tàu đang có chuyến dang_chay
    INNER JOIN chuyen_di cd_check
        ON cd_check.ma_tau_chay = t.ma_tau
        AND cd_check.trang_thai = 'dang_chay'
    WHERE t.lat IS NOT NULL AND t.lng IS NOT NULL
`);

        // Chuyển mảng kết quả thành Object Map (Key là ma_tau)
        // const devices = res.rows.reduce((acc: any, row) => {
        const devices = res.rows.reduce<Record<string, DeviceStatus & { signal: number, timestamp: number }>>((acc, row) => {
            acc[row.ma_tau] = {
                lat: row.lat,
                lng: row.lng,
                speed: row.speed,
                heading: row.heading,
                battery: row.battery,
                signal: row.signal,
                vibration: row.vibration,
                alert: row.alert,
                timestamp: Number(row.timestamp), //ép kiểu số do PostgreSQL BIGINT trả về string 
                danh_sach_toa: row.danh_sach_toa,
                danh_sach_ga_chi_tiet: row.danh_sach_ga_chi_tiet, // Đẩy mảng ga chi tiết đã đối chiếu ra ngoài cho Frontend Map.tsx nhận diện
                socketData: undefined
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