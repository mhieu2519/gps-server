// app/api/dispatch/schedule/trips/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        // Lấy danh sách chuyến đi, sắp xếp theo ngày chạy giảm dần (mới nhất lên đầu)
        const result = await db.query(`
            SELECT ma_chuyen_di, ma_tau, ngay_chay, ma_dau_may, ma_lo_trinh, trang_thai 
            FROM lich_chay_tau 
            ORDER BY ngay_chay DESC, ma_chuyen_di ASC
        `);

        return NextResponse.json(result.rows);
    } catch (error: any) {
        console.error("❌ Lỗi API lấy danh sách chuyến đi:", error);
        return NextResponse.json({ error: 'Lỗi máy chủ: ' + error.message }, { status: 500 });
    }
}