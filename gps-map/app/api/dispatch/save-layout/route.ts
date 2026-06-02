import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

export async function POST(request: Request) {
    // Kiểm tra quyền admin
    const authError = await requireAdmin();
    if (authError) return authError;

    try {
        const body = await request.json();
        const { selectedTrip, layout, trainHead, ma_lo_trinh } = body;

        // Kiểm tra dữ liệu đầu vào cơ bản
        if (!selectedTrip || !Array.isArray(layout)) {
            return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
        }

        await db.query("BEGIN");

        // BƯỚC 1: Tìm các toa hàng cũ của chuyến đi này để giải phóng lại về kho (is_processed = false)
        const oldCargoRows = await db.query(
            `SELECT ma_toa FROM chi_tiet_lap_tau 
             WHERE ma_chuyen_di = $1 AND ma_toa IN (SELECT ma_toa FROM du_lieu_tau_hang)`,
            [selectedTrip]
        );

        const oldCargoCodes = oldCargoRows.rows.map(r => r.ma_toa);
        if (oldCargoCodes.length > 0) {
            await db.query(
                "UPDATE du_lieu_tau_hang SET is_processed = false WHERE ma_toa = ANY($1::text[])",
                [oldCargoCodes]
            );
        }

        // BƯỚC 2: Xóa cấu hình lập tàu cũ trong bảng chi_tiet_lap_tau
        await db.query(
            "DELETE FROM chi_tiet_lap_tau WHERE ma_chuyen_di = $1",
            [selectedTrip]
        );

        // BƯỚC 3: Chèn thứ tự các toa xe mới vào đoàn tàu
        for (let i = 0; i < layout.length; i++) {
            const carriage = layout[i];
            const thu_tu_toa = i + 1;

            // Khớp chuẩn tên mã toa từ Map.tsx (ưu tiên ma_toa rồi mới tới carriage_code)
            const ma_toa_thuc_te = carriage.ma_toa || carriage.carriage_code;
            if (!ma_toa_thuc_te) {
                throw new Error(`Toa xe ở vị trí số ${thu_tu_toa} không tìm thấy mã toa (ma_toa)`);
            }

            // Đọc khối lượng/số lượng từ các thuộc tính linh hoạt gửi từ Frontend
            // Map.tsx dùng `tai_trong`, dữ liệu gốc có thể là `khoi_luong_thuc_te` hoặc `current_cargo_weight`
            const so_luong_thuc_te = carriage.tai_trong || carriage.khoi_luong_thuc_te || carriage.current_cargo_weight || carriage.current_passenger_count || 0;

            // Đề phòng thuộc tính hoạt động viết thường hoặc viết hoa
            const trang_thai_hoat_dong = carriage.is_active ?? carriage.isActive ?? true;

            await db.query(
                `INSERT INTO chi_tiet_lap_tau (ma_chuyen_di, ma_toa, thu_tu_toa, is_active, so_luong_thuc_te)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    selectedTrip,
                    ma_toa_thuc_te,
                    thu_tu_toa,
                    trang_thai_hoat_dong,
                    so_luong_thuc_te
                ]
            );
        }

        // BƯỚC 4: Cập nhật trạng thái 'is_processed = true' cho các toa hàng nằm trong cấu hình mới này
        // Lọc lấy toàn bộ ma_toa của các toa có loại là HANG_HOA (hoặc dựa trên cấu trúc dữ liệu của bạn)
        const currentCargoCarriageCodes = layout
            .filter((c: any) => c.loai_toa === "HANG_HOA" || c.type === "HANG_HOA" || c.ten_hang_hoa)
            .map((c: any) => c.ma_toa || c.carriage_code)
            .filter(Boolean);

        if (currentCargoCarriageCodes.length > 0) {
            await db.query(
                "UPDATE du_lieu_tau_hang SET is_processed = true WHERE ma_toa = ANY($1::text[])",
                [currentCargoCarriageCodes]
            );
        }

        // BƯỚC 5: Cập nhật thông tin lộ trình & đầu máy vào lịch trình chuyến đi
        // Cập nhật bảng lich_chay_tau
        await db.query(
            `UPDATE lich_chay_tau SET ma_dau_may = $1, ma_lo_trinh = $2 WHERE ma_chuyen_di = $3`,
            [trainHead || null, ma_lo_trinh || null, selectedTrip]
        );

        // Đồng bộ cập nhật luôn sang bảng chuyen_di (bảng này không có ma_dau_may nên chỉ cập nhật ma_lo_trinh)
        await db.query(
            `UPDATE chuyen_di SET ma_lo_trinh = $1 WHERE ma_chuyen_di = $2`,
            [ma_lo_trinh || null, selectedTrip]
        );

        await db.query("COMMIT");
        return NextResponse.json({ success: true, message: "Lưu cấu hình lập đoàn tàu thành công!" });

    } catch (error: any) {
        await db.query("ROLLBACK");
        console.error("❌ Lỗi API save-layout chi tiết:");
        console.error("Thông báo lỗi:", error.message);
        if (error.detail) console.error("Chi tiết từ Postgres:", error.detail);

        return NextResponse.json(
            { error: `Lỗi Database: ${error.message || "Xử lý cấu hình thất bại"}` },
            { status: 500 }
        );
    }
}