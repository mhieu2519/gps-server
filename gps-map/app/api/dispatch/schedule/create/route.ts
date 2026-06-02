// app/api/dispatch/schedule/create/route.ts
// nhận thông tin từ Client gửi lên (mác tàu, ngày chạy) để tạo mới một lịch chạy tàu trong bảng lich_chay_tau
import { NextResponse } from 'next/server';
import { db } from '@/lib/db'; // Đường dẫn đến file kết nối Postgres của bạn
import { requireAdmin } from '@/lib/auth-guard';

export async function POST(request: Request) {
    // Kiểm tra quyền admin
    const authError = await requireAdmin();
    if (authError) return authError;
    try {
        const { ma_tau, ngay_chay } = await request.json();

        if (!ma_tau || !ngay_chay) {
            return NextResponse.json({ error: 'Thiếu thông tin mác tàu hoặc ngày chạy' }, { status: 400 });
        }

        // Tự động sinh mã chuyến đi, ví dụ: ngày 2026-06-05 -> đổi thành 2026_06_05
        const formattedDate = ngay_chay.replace(/-/g, '_');
        const ma_chuyen_di = `${ma_tau}_${formattedDate}`;

        // Kiểm tra xem chuyến đi này đã được tạo trước đó chưa (tránh trùng Khóa chính)
        const checkExist = await db.query(
            'SELECT ma_chuyen_di FROM lich_chay_tau WHERE ma_chuyen_di = $1',
            [ma_chuyen_di]
        );

        if (checkExist.rows.length > 0) {
            return NextResponse.json({ error: `Chuyến đi ${ma_chuyen_di} đã tồn tại trong hệ thống rồi!` }, { status: 400 });
        }

        // Tiến hành chèn dữ liệu mới vào bảng lịch chạy tàu
        await db.query(`
            INSERT INTO lich_chay_tau (ma_chuyen_di, ma_tau, ngay_chay, trang_thai)
            VALUES ($1, $2, $3, 'CHO_LAP_TAU')
        `, [ma_chuyen_di, ma_tau, ngay_chay]);

        return NextResponse.json({ success: true, ma_chuyen_di });

    } catch (error: any) {
        console.error("❌ Lỗi API tạo lịch chạy tàu:", error);
        return NextResponse.json({ error: 'Lỗi máy chủ nội bộ: ' + error.message }, { status: 500 });
    }
}