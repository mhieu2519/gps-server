// gps-server/gps-map/app/api/dispatch/save-layout/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

export async function POST(request: Request) {
    // Kiểm tra quyền admin
    const authError = await requireAdmin();
    if (authError) return authError;
    try {
        const body = await request.json();
        const { selectedTrip, layout } = body;
        const { trainHead, ma_lo_trinh } = body;
        if (!selectedTrip || !Array.isArray(layout)) {
            return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
        }

        await db.query("BEGIN");

        // KHẮC PHỤC LỖI: Tìm các toa hàng cũ của chuyến đi này để giải phóng lại về kho (is_processed = false)
        const oldCargoRows = await db.query(
            `SELECT ma_toa FROM chi_tiet_lap_tau 
             WHERE ma_chuyen_di = $1 AND ma_toa IN (SELECT ma_toa FROM du_lieu_tau_hang)`,
            [selectedTrip]
        );
        const oldCargoCodes = oldCargoRows.rows.map(r => r.ma_toa);
        if (oldCargoCodes.length > 0) {
            await db.query(
                "UPDATE du_lieu_tau_hang SET is_processed = false WHERE ma_toa = ANY($1)",
                [oldCargoCodes]
            );
        }

        // Bước 1: Xóa cấu hình lập tàu cũ
        await db.query(
            "DELETE FROM chi_tiet_lap_tau WHERE ma_chuyen_di = $1",
            [selectedTrip]
        );

        // Bước 2: Chèn thứ tự toa mới
        for (let i = 0; i < layout.length; i++) {
            const carriage = layout[i];
            const thu_tu_toa = i + 1;

            // Xác định số lượng dựa vào loại toa khách hoặc hàng hóa
            // LƯU Ý SỬA LỖI TS: Sử dụng trường 'type' khớp với Interface Frontend
            const so_luong_thuc_te = carriage.type === "HANG_HOA"
                ? (carriage.current_cargo_weight || 0)
                : (carriage.current_passenger_count || 0);

            await db.query(
                `INSERT INTO chi_tiet_lap_tau (ma_chuyen_di, ma_toa, thu_tu_toa, is_active, so_luong_thuc_te)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    selectedTrip,
                    carriage.carriage_code,
                    thu_tu_toa,
                    carriage.isActive,
                    so_luong_thuc_te
                ]
            );
        }

        // Bước 3: Cập nhật trạng thái các toa hàng hiện tại có trong đoàn tàu mới thành true
        const currentCargoCarriageCodes = layout
            .filter((c: any) => c.type === "HANG_HOA")
            .map((c: any) => c.carriage_code);

        if (currentCargoCarriageCodes.length > 0) {
            await db.query(
                "UPDATE du_lieu_tau_hang SET is_processed = true WHERE ma_toa = ANY($1)",
                [currentCargoCarriageCodes]
            );
        }

        // Bước 4: Cập nhật thông tin chuyến đi
        await db.query(
            `UPDATE lich_chay SET ma_dau_may = $1, ma_lo_trinh = $2 WHERE ma_chuyen_di = $3`,
            [trainHead || null, ma_lo_trinh || null, selectedTrip]
        );

        await db.query("COMMIT");
        return NextResponse.json({ success: true, message: "Lưu cấu hình lập đoàn tàu thành công!" });

    } catch (error) {
        await db.query("ROLLBACK");
        console.error("❌ Lỗi API save-layout:", error);
        return NextResponse.json({ error: "Lỗi kết nối hoặc xử lý Database" }, { status: 500 });
    }
}