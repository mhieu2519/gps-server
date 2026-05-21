"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import LoginModal from "./LoginModal"; // Đảm bảo file LoginModal.tsx nằm cùng thư mục này

export default function Header() {
    // 1. Lấy thông tin phiên đăng nhập và trạng thái từ NextAuth
    const { data: session, status } = useSession();

    // 2. State quản lý trạng thái Đóng/Mở của Popup Đăng nhập
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <header className="fixed top-0 left-0 w-full h-16 bg-white/90 backdrop-blur-md z-[1000] border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="font-bold text-xl text-cyan-700">GPS Tracking</div>

                    <nav className="hidden md:flex gap-8 text-gray-600 font-medium">
                        <Link href="/" className="hover:text-cyan-600 transition">
                            Bản đồ
                        </Link>

                        {/* KIỂM TRA QUYỀN ADMIN: Chỉ hiển thị nút này nếu role trong DB là admin */}
                        {session?.user?.role === "admin" && (
                            <Link href="/admin/dispatch" className="text-amber-600 hover:text-amber-700 font-bold transition flex items-center gap-1 animate-pulse">
                                ⚙️ Điều phối toa
                            </Link>
                        )}

                        <Link href="/about" className="hover:text-cyan-600 transition">
                            Giới thiệu
                        </Link>
                        <Link href="/services" className="hover:text-cyan-600 font-medium">
                            Dịch vụ
                        </Link>
                        <Link href="/contact" className="hover:text-cyan-600 transition">
                            Liên hệ
                        </Link>
                    </nav>

                    {/* KHU VỰC XỬ LÝ NÚT ĐĂNG NHẬP / THÔNG TIN USER DỰA TRÊN STATUS */}
                    <div className="flex items-center gap-4">
                        {status === "loading" ? (
                            // Trạng thái đang kiểm tra cookie/session
                            <span className="text-sm text-gray-400 font-medium">Đang tải...</span>
                        ) : session ? (
                            // TRẠNG THÁI: ĐÃ ĐĂNG NHẬP THÀNH CÔNG
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-700 font-medium">
                                    Xin chào,{" "}
                                    <span className={session.user.role === "admin" ? "text-amber-600 font-bold" : "text-cyan-600 font-semibold"}>
                                        {session.user.name}
                                    </span>
                                </span>
                                <button
                                    onClick={() => signOut({ callbackUrl: "/" })} // Đăng xuất xong đưa về trang chủ công khai
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
                                >
                                    Đăng xuất
                                </button>
                            </div>
                        ) : (
                            // TRẠNG THÁI: CHƯA ĐĂNG NHẬP (Mặc định)
                            <button
                                onClick={() => setIsModalOpen(true)} // Click vào đây sẽ mở popup lên
                                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
                            >
                                Đăng nhập
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* 3. Gọi component Popup nằm ẩn ở đây, điều khiển đóng mở qua State */}
            <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
}