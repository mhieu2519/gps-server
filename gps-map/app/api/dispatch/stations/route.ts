import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-guard';

export async function GET(request: Request) {
    // Kiểm tra quyền admin
    const authError = await requireAdmin();
    if (authError) return authError;

    try {

        const result = await db.query('SELECT ma_ga, ten_ga FROM ga ORDER BY ten_ga ASC');
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error("Lỗi lấy danh mục ga:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}