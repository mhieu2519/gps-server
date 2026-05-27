// File: gps-server/gps-map/app/api/dispatch/save-layout/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { selectedTrip, layout } = body; // layout là mảng trainLayout từ client gửi lên

        if (!selectedTrip || !Array.isArray(layout)) {
            return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
        }

        // Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
        await db.query("BEGIN");

        // Bước 1: Xóa toàn bộ cấu hình lập tàu cũ của chuyến đi này để ghi đè cấu hình mới
        await db.query(
            "DELETE FROM chi_tiet_lap_tau WHERE ma_chuyen_di = $1",
            [selectedTrip]
        );

        // Bước 2: Duyệt mảng layout để chèn thứ tự toa mới vào bảng chi_tiet_lap_tau
        for (let i = 0; i < layout.length; i++) {
            const carriage = layout[i];
            const thu_tu_toa = i + 1; // Vị trí vật lý trên ray

            await db.query(
                `INSERT INTO chi_tiet_lap_tau (ma_chuyen_di, ma_toa, thu_tu_toa, is_active, so_luong_thuc_te)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    selectedTrip,
                    carriage.carriage_code,
                    thu_tu_toa,
                    carriage.isActive,
                    carriage.type === "HANG_HOA" ? carriage.current_cargo_weight : carriage.current_passenger_count
                ]
            );
        }

        // Bước 3: Cập nhật trạng thái các toa hàng đã được điều phối vào bãi (is_processed = true)
        const cargoCarriageCodes = layout
            .filter((c: any) => c.type === "HANG_HOA")
            .map((c: any) => c.carriage_code);

        if (cargoCarriageCodes.length > 0) {
            await db.query(
                "UPDATE du_lieu_tau_hang SET is_processed = true WHERE ma_toa = ANY($1)",
                [cargoCarriageCodes]
            );
        }

        await db.query("COMMIT");
        return NextResponse.json({ success: true, message: "Lưu cấu hình lập đoàn tàu thành công!" });

    } catch (error) {
        await db.query("ROLLBACK");
        console.error("❌ Lỗi API save-layout:", error);
        return NextResponse.json({ error: "Lỗi kết nối hoặc xử lý Database" }, { status: 500 });
    }
}