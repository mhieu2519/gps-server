import { NextResponse } from 'next/server';
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

export async function POST(request: Request) {
    // Kiểm tra quyền admin
    const authError = await requireAdmin();
    if (authError) return authError;
    try {
        const body = await request.json();
        const { ma_lo_trinh, ten_lo_trinh, danh_sach_ga } = body;

        // Validate dữ liệu cơ bản từ Client gửi lên
        if (!ma_lo_trinh || !ten_lo_trinh || !danh_sach_ga || !Array.isArray(danh_sach_ga)) {
            return NextResponse.json(
                { error: 'Thiếu thông tin hoặc danh sách ga không hợp lệ.' },
                { status: 400 }
            );
        }

        // Thực hiện câu lệnh INSERT hoặc UPDATE nếu trùng mã lộ trình (ON CONFLICT)
        // Node-postgres tự động chuyển đổi mảng Javascript (danh_sach_ga) thành định dạng mảng của Postgres TEXT[]
        await db.query(
            `INSERT INTO lo_trinh (ma_lo_trinh, ten_lo_trinh, danh_sach_ga)
             VALUES ($1, $2, $3)
             ON CONFLICT (ma_lo_trinh) 
             DO UPDATE SET ten_lo_trinh = $2, danh_sach_ga = $3`,
            [ma_lo_trinh, ten_lo_trinh, danh_sach_ga]
        );

        return NextResponse.json({
            success: true,
            message: "Đã thêm mới/cập nhật danh mục lộ trình thành công."
        });

    } catch (error) {
        console.error("❌ Lỗi API tại /api/dispatch/create:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}