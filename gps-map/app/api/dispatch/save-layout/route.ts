// /app/api/dispatch/save-layout/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

export async function POST(request: Request) {
    const authError = await requireAdmin();
    if (authError) return authError;

    const client = await db.connect();

    try {
        const body = await request.json();
        const { selectedTrip, layout, trainHead, ma_lo_trinh } = body;

        if (!selectedTrip || !Array.isArray(layout)) {
            return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
        }

        await client.query("BEGIN");

        // BƯỚC 1: KIỂM TRA & CẬP NHẬT TRẠNG THÁI CHUYẾN ĐI
        const tripCheck = await client.query("SELECT ma_chuyen_di FROM chuyen_di WHERE ma_chuyen_di = $1", [selectedTrip]);
        if ((tripCheck.rowCount ?? 0) === 0) {
            // Nếu chưa có chuyến đi ở bảng vận hành, tự động khởi tạo dựa theo lịch chạy tàu
            const scheduleCheck = await client.query("SELECT ngay_chay FROM lich_chay_tau WHERE ma_chuyen_di = $1", [selectedTrip]);
            const ngay_chay = scheduleCheck.rows[0]?.ngay_chay || new Date();

            await client.query(
                `INSERT INTO chuyen_di (ma_chuyen_di, ngay_chay, trang_thai) VALUES ($1, $2, 'san_sang')`,
                [selectedTrip, ngay_chay]
            );
        }

        // BƯỚC 2: GIẢI PHÓNG TOA CŨ TRƯỚC KHI ĐỒNG BỘ CẤU HÌNH MỚI
        const oldCarriages = await client.query(`SELECT ma_toa FROM chi_tiet_lap_tau WHERE ma_chuyen_di = $1`, [selectedTrip]);
        const oldToaCodes = oldCarriages.rows.map(r => r.ma_toa);

        if (oldToaCodes.length > 0) {
            // Trả trạng thái về 'chờ phân phối' (is_processed = false) cho các bảng nguồn dữ liệu thô
            await client.query(`UPDATE du_lieu_tau_hang SET is_processed = false WHERE ma_toa = ANY($1::varchar[])`, [oldToaCodes]);
            await client.query(`UPDATE du_lieu_dat_ve SET is_processed = false WHERE ma_toa = ANY($1::varchar[])`, [oldToaCodes]);
        }

        // BƯỚC 3: XÓA CẤU TRÚC LẬP TÀU CŨ CỦA RIÊNG CHUYẾN NÀY
        await client.query(`DELETE FROM chi_tiet_lap_tau WHERE ma_chuyen_di = $1`, [selectedTrip]);

        // BƯỚC 4: VÒNG LẶP PHÂN PHỐI DỮ LIỆU ĐẾN CÁC BẢNG LIÊN QUAN
        const insertValues: any[] = [];
        const insertRows: string[] = [];
        const processedCargoCodes: string[] = [];
        const processedTicketCodes: string[] = [];

        for (let i = 0; i < layout.length; i++) {
            const carriage = layout[i];
            const thu_tu_toa = i + 1;
            const ma_toa = carriage.ma_toa || carriage.carriage_code;

            if (!ma_toa) continue;

            const is_active = carriage.is_active ?? carriage.isActive ?? true;
            // fix lỗi mất dữ liệu số lượng thực tế: ưu tiên lấy từ các trường khác nhau nếu có, mặc định 0
            // const so_luong_thuc_te = carriage.tai_trong || carriage.khoi_luong_thuc_te || carriage.so_luong_thuc_te || 0;
            const isCargo = carriage.loai_toa === "HANG_HOA" || carriage.type === "HANG_HOA" || !!carriage.ten_hang_hoa;
            const so_luong_thuc_te =
                carriage.current_cargo_weight ??
                carriage.current_passenger_count ??
                carriage.so_luong_thuc_te ??
                carriage.tai_trong ??
                carriage.khoi_luong_thuc_te ??
                0;
            // Đơn vị: toa hàng lấy từ dữ liệu tàu hàng sẵn có, toa khách mặc định "người"
            const don_vi = isCargo ? (carriage.don_vi || "tấn") : "người";
            // 4.1: Đồng bộ (Upsert) danh mục cấu trúc cứng vào bảng public.toa
            await client.query(`
                INSERT INTO public.toa (ma_toa, loai_toa, kieu_cho,suc_chua_toi_da, tai_trong, don_vi)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (ma_toa) 
                DO UPDATE SET 
                    loai_toa = EXCLUDED.loai_toa, 
                    suc_chua_toi_da = EXCLUDED.suc_chua_toi_da,
                    tai_trong = EXCLUDED.tai_trong,
                    don_vi = EXCLUDED.don_vi
            `, [
                ma_toa,
                carriage.loai_toa || carriage.type,
                carriage.kieu_cho || null,
                // carriage.max_capacity || carriage.suc_chua_toi_da || null,
                carriage.max_cargo_capacity || carriage.max_capacity || carriage.suc_chua_toi_da || null,
                so_luong_thuc_te,
                don_vi
            ]);

            // 4.2: Gom mảng để chuẩn bị Bulk Insert vào cấu trúc lập tàu
            const n = insertValues.length;
            insertRows.push(`($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5})`);
            insertValues.push(selectedTrip, ma_toa, thu_tu_toa, is_active, so_luong_thuc_te);

            // 4.3: Phân loại danh sách mã toa để đánh dấu hoàn tất xử lý (Processed) ở các bảng nguồn thô
            if (isCargo) {
                processedCargoCodes.push(ma_toa);
            } else {
                processedTicketCodes.push(ma_toa);
            }
        }

        // Thực hiện Bulk Insert danh sách toa xe mới vào cấu trúc lập tàu
        if (insertRows.length > 0) {
            await client.query(`
                INSERT INTO chi_tiet_lap_tau (ma_chuyen_di, ma_toa, thu_tu_toa, is_active, so_luong_thuc_te)
                VALUES ${insertRows.join(", ")}
            `, insertValues);
        }

        // BƯỚC 5: ĐÁNH DẤU IS_PROCESSED = TRUE ĐỂ CHUYẾN SAU KHÔNG LẤY TRÙNG TOA ĐANG CHẠY
        if (processedCargoCodes.length > 0) {
            await client.query(`UPDATE du_lieu_tau_hang SET is_processed = true WHERE ma_toa = ANY($1::varchar[])`, [processedCargoCodes]);
        }
        if (processedTicketCodes.length > 0) {
            await client.query(`UPDATE du_lieu_dat_ve SET is_processed = true WHERE ma_toa = ANY($1::varchar[])`, [processedTicketCodes]);
        }

        // BƯỚC 6: ĐỒNG BỘ ĐẦU MÁY VÀ LỘ TRÌNH VỀ CÁC BẢNG LỊCH TRÌNH
        // Nếu có đầu máy mới, thêm vào bảng public.tau nếu chưa tồn tại, sau đó cập nhật vào lich_chay_tau và chuyen_di
        if (trainHead) {
            await client.query(`
                INSERT INTO public.tau (ma_tau, timestamp)
                VALUES ($1, $2)
                ON CONFLICT (ma_tau) DO NOTHING
            `, [trainHead, Math.floor(Date.now() / 1000)]);
        }
        await client.query(
            `UPDATE lich_chay_tau 
             SET ma_dau_may = $1, ma_lo_trinh = $2, trang_thai = 'DA_LAP_TAU' 
             WHERE ma_chuyen_di = $3`,
            [trainHead || null, ma_lo_trinh || null, selectedTrip]
        );

        await client.query(
            `UPDATE chuyen_di 
             SET ma_tau_chay = $1, 
             ma_lo_trinh = $2, 
             trang_thai = 'dang_chay' -- Chuyển sang dang_chay để luồng quét GPS bắt đầu bắt tín hiệu hiển thị toa xe
             WHERE ma_chuyen_di = $3`,
            [trainHead || null, ma_lo_trinh || null, selectedTrip]
        );
        await client.query("COMMIT");
        return NextResponse.json({ success: true, message: "Phân phối dữ liệu lập tàu thành công!" });

    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("❌ Lỗi API phân phối lưu cấu hình:", error.message);
        return NextResponse.json({ error: `Lỗi xử lý luồng lưu trữ: ${error.message}` }, { status: 500 });
    } finally {
        client.release();
    }
}