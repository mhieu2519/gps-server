import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        // Lấy toàn bộ danh mục lộ trình từ bảng lo_trinh, sắp xếp theo mã hoặc tên 
        const result = await db.query('SELECT ma_lo_trinh, ten_lo_trinh, danh_sach_ga FROM lo_trinh ORDER BY ma_lo_trinh ASC');
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error("Lỗi lấy danh sách lộ trình:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}