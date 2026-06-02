import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

export async function GET(request: Request) {
    // Kiểm tra quyền admin
    const authError = await requireAdmin();
    if (authError) return authError;

    try {
        // Lấy toàn bộ danh mục lộ trình từ bảng lo_trinh, sắp xếp theo mã hoặc tên 
        const result = await db.query('SELECT ma_lo_trinh, ten_lo_trinh, danh_sach_ga FROM lo_trinh ORDER BY ma_lo_trinh ASC');
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error("Lỗi lấy danh sách lộ trình:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}