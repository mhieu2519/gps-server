// File: gps-server/gps-map/app/api/dispatch/available-cargo/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
    try {
        // Chỉ lấy các toa hàng mới từ bãi kho, chưa gán vào hành trình nào
        const result = await db.query(
            "SELECT * FROM du_lieu_tau_hang WHERE is_processed = false ORDER BY created_at DESC"
        );
        return NextResponse.json(result.rows);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi kết nối DB" }, { status: 500 });
    }
}