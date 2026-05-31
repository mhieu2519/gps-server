import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {

        const result = await db.query('SELECT ma_ga, ten_ga FROM ga ORDER BY ten_ga ASC');
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error("Lỗi lấy danh mục ga:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}