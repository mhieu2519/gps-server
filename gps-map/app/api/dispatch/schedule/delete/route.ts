// app/api/dispatch/schedule/delete/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

export async function DELETE(request: Request) {
    // Kiểm tra quyền admin
    const authError = await requireAdmin();
    if (authError) return authError;
    try {
        const { ma_chuyen_di } = await request.json();

        if (!ma_chuyen_di) {
            return NextResponse.json({ error: 'Thiếu mã chuyến đi cần xóa' }, { status: 400 });
        }

        // Kiểm tra xem tàu có đang chạy không, nếu DANG_CHAY thì không cho xóa
        const checkStatus = await db.query(
            'SELECT trang_thai FROM lich_chay_tau WHERE ma_chuyen_di = $1',
            [ma_chuyen_di]
        );

        if (checkStatus.rows.length > 0 && checkStatus.rows[0].trang_thai === 'DANG_CHAY') {
            return NextResponse.json({ error: 'Không thể xóa chuyến đi đang chạy thực tế!' }, { status: 400 });
        }

        // Tiến hành xóa
        await db.query('DELETE FROM lich_chay_tau WHERE ma_chuyen_di = $1', [ma_chuyen_di]);

        return NextResponse.json({ success: true, message: `Đã xóa chuyến đi ${ma_chuyen_di}` });

    } catch (error: any) {
        console.error("❌ Lỗi API xóa chuyến đi:", error);
        return NextResponse.json({ error: 'Lỗi máy chủ: ' + error.message }, { status: 500 });
    }
}