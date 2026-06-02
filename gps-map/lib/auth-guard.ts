import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requireAdmin() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if ((session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }

    return null; // null = OK, được phép tiếp tục
}