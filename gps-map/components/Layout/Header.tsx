"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import LoginModal from "./LoginModal";

//icon
import { FaChartLine } from "react-icons/fa";
import { FaTrain } from "react-icons/fa6";
import { GiCaptainHatProfile } from "react-icons/gi";
import { FcBullish } from "react-icons/fc";
import { CgPushUp } from "react-icons/cg";

export default function Header() {
    const { data: session, status } = useSession();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <>
            <header className="fixed top-0 left-0 w-full h-16 bg-white/90 backdrop-blur-md z-[1000] border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link
                        href="/"
                        className="font-bold text-xl text-cyan-700 tracking-tight hover:text-cyan-500 transition"
                    >
                        GPS Tracking
                    </Link>

                    {/* Navigation chính (Đã bỏ Điều phối toa) */}
                    <nav className="hidden md:flex gap-8 text-gray-600 font-medium">
                        <Link href="/" className="hover:text-cyan-600 transition">Bản đồ</Link>
                        <Link href="/about" className="hover:text-cyan-600 transition">Giới thiệu</Link>
                        <Link href="/services" className="hover:text-cyan-600 transition">Dịch vụ</Link>
                        <Link href="/contact" className="hover:text-cyan-600 transition">Liên hệ</Link>
                    </nav>

                    {/* Khu vực Người dùng */}
                    <div className="flex items-center gap-4">
                        {session && status === "authenticated" ? (
                            <div className="relative" ref={dropdownRef}>
                                {/* Nút Avatar tròn */}
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:border-cyan-500 hover:bg-gray-50 transition shadow-sm"
                                >
                                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {isDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                                        {/* Header Menu: Tên & Role */}
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Tài khoản</p>
                                            <p className="text-sm font-bold text-gray-800 truncate mt-0.5">{session.user.name}</p>
                                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 ${session.user.role === "admin"
                                                ? "bg-amber-50 text-amber-600 border border-amber-200"
                                                : "bg-cyan-50 text-cyan-600 border border-cyan-200"
                                                }`}>
                                                {session.user.role === "admin" ? "Quản trị viên" : "Thành viên"}
                                            </span>
                                        </div>

                                        {/* Các chức năng */}
                                        <div className="py-1">
                                            <Link href="/profile" onClick={() => setIsDropdownOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-cyan-600 transition">

                                                <GiCaptainHatProfile />
                                                <span className="ml-2">
                                                    Trang cá nhân
                                                </span>

                                            </Link>

                                            {/* CHỨC NĂNG ADMIN: Đưa Điều phối toa vào đây */}
                                            {session.user.role === "admin" && (
                                                <>

                                                    <Link
                                                        href="/admin/dashboard"
                                                        onClick={() => setIsDropdownOpen(false)}
                                                        className="flex items-center px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
                                                    >
                                                        <FcBullish />
                                                        <span className="ml-2">
                                                            Thống kê
                                                        </span>
                                                    </Link>
                                                    <Link
                                                        href="/admin/dispatch"
                                                        onClick={() => setIsDropdownOpen(false)}
                                                        className="flex items-center px-4 py-2.5 text-sm text-amber-600 bg-amber-50/50 hover:bg-amber-50 font-bold transition"
                                                    >

                                                        <FaTrain />
                                                        <span className="ml-2">
                                                            Điều phối toa
                                                        </span>

                                                    </Link>
                                                    <Link
                                                        href="/admin/station/update"
                                                        onClick={() => setIsDropdownOpen(false)}
                                                        className="flex items-center px-4 py-2.5 text-sm text-cyan-600 bg-cyan-50/50 hover:bg-cyan-50 font-bold transition"
                                                    >
                                                        <CgPushUp />
                                                        <span className="ml-2">
                                                            Cập nhật tại ga
                                                        </span>
                                                    </Link>
                                                </>
                                            )}
                                        </div>

                                        {/* Đăng xuất */}
                                        <div className="border-t border-gray-100 pt-1 mt-1">
                                            <button
                                                onClick={() => signOut({ callbackUrl: "/" })}
                                                className="w-full text-left flex items-center px-4 py-2.5 text-sm text-cyan-500 hover:bg-cyan-50 font-medium transition"
                                            >
                                                Đăng xuất
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
                            >
                                Đăng nhập
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
}