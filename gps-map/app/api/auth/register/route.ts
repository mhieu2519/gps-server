// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { db } from "@/lib/db";

export async function POST(request: Request) {
    try {
        // 1. Đọc dữ liệu user và passwd từ body mà Popup gửi lên
        const { user, passwd } = await request.json();

        // Kiểm tra dữ liệu đầu vào xem có bị trống không
        if (!user || !passwd) {
            return NextResponse.json(
                { message: "Vui lòng điền đầy đủ tài khoản và mật khẩu!" },
                { status: 400 }
            );
        }

        // 2. Kết nối CSDL kiểm tra xem tài khoản này đã được đăng ký chưa
        const checkQuery = "SELECT * FROM tai_khoan WHERE ten_dang_nhap = $1 LIMIT 1";
        const checkResult = await db.query(checkQuery, [user]);

        if (checkResult.rows.length > 0) {
            return NextResponse.json(
                { message: "Tài khoản này đã tồn tại trên hệ thống!" },
                { status: 400 }
            );
        }

        // 3. Mã hóa mật khẩu một chiều bằng bcrypt với saltRounds = 10 để bảo mật tuyệt đối
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(passwd, saltRounds);

        // 4. Chèn dữ liệu tài khoản mới vào bảng tai_khoan trong DBeaver
        // Cột 'role' gán cứng giá trị là 'user', cột 'lastTime' tạm thời để NULL
        const insertQuery = `
            INSERT INTO tai_khoan (ten_dang_nhap, mat_khau, vai_tro, "lastTime") 
            VALUES ($1, $2, $3, NOW())
        `;
        await db.query(insertQuery, [user, hashedPassword, "user"]);

        // 5. Trả kết quả thành công về cho Popup
        return NextResponse.json(
            { message: "Đăng ký tài khoản thành công!" },
            { status: 201 }
        );

    } catch (error) {
        console.error("❌ Lỗi hệ thống khi đăng ký:", error);
        return NextResponse.json(
            { message: "Có lỗi xảy ra từ phía máy chủ khi kết nối CSDL!" },
            { status: 500 }
        );
    }
}