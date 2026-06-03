// gps-server/gps-map/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET
    });
    const userRole = token?.role;

    // Chặn tất cả những ai CHƯA ĐĂNG NHẬP muốn vào bất kỳ trang nào thuộc /admin
    if (pathname.startsWith('/admin') && !userRole) {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = '/';
        return NextResponse.redirect(homeUrl);
    }

    //  Chặn tài khoản USER thường 
    if (pathname.startsWith('/admin') && userRole === 'user') {
        const forbiddenUrl = request.nextUrl.clone();
        forbiddenUrl.pathname = '/403';
        return NextResponse.redirect(forbiddenUrl);
    }

    // PHÂN QUYỀN CHI TIẾT TRONG VÙNG ADMIN

    // Các trang ĐẶC QUYỀN (Chỉ Admin mới được vào, Supervisor cũng bị chặn)
    const adminOnlyRoutes = ['/admin/dashboard', '/admin/dispatch'];
    if (adminOnlyRoutes.some(route => pathname.startsWith(route))) {
        if (userRole !== 'admin') {
            const forbiddenUrl = request.nextUrl.clone();
            forbiddenUrl.pathname = '/403'; // Đá supervisor ra trang báo lỗi nếu cố tình vào
            return NextResponse.redirect(forbiddenUrl);
        }
    }

    //Đối với trang cập nhật ga: /admin/station/update
    // Do đã vượt qua lớp 1 và lớp 2, nên lúc này userRole chắc chắn là 'admin' hoặc 'supervisor'
    // Hệ thống sẽ tự động cho phép (NextResponse.next()) đi tiếp vào trang mà không chặn lại.

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};