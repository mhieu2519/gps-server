// components/layout/Header.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";


export default function Header() {
    return (
        <header className="fixed top-0 left-0 w-full h-16 bg-white/90 backdrop-blur-md z-[1000] border-b shadow-sm">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="font-bold text-xl text-cyan-700">GPS Tracking</div>

                <nav className="hidden md:flex gap-8 text-gray-600 font-medium">
                    <Link href="/" className="hover:text-cyan-600 transition">
                        Bản đồ
                    </Link>
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

                <button className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm">
                    Đăng nhập
                </button>
            </div>
        </header>
    );
}