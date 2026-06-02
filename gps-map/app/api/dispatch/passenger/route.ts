// gps-server/gps-map/app/api/dispatch/passenger/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // Đường dẫn đến file cấu hình kết nối Postgres của bạn
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(request: Request) {
    //kiểm tra quyền admin
    const authError = await requireAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const trip = searchParams.get("trip");

    try {
        // Query dữ liệu đặt vé dựa theo chuyến đi (ví dụ: SE1_2026_05_23)
        const result = await db.query(
            "SELECT * FROM du_lieu_dat_ve WHERE ma_chuyen_di = $1 ORDER BY id ASC",
            [trip]
        );
        return NextResponse.json(result.rows);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi kết nối DB" }, { status: 500 });
    }
}