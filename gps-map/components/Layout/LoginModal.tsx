// components/layout/LoginModal.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const [isLogin, setIsLogin] = useState(true); // true = Đăng nhập, false = Đăng ký
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null; // Nếu không mở thì không vẽ giao diện ra màn hình

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const result = await signIn("credentials", {
            username,
            password,
            redirect: false,
        });
        setLoading(false);

        if (result?.error) {
            alert("❌ Tài khoản hoặc mật khẩu không chính xác!");
        } else {
            alert("🎉 Đăng nhập thành công!");
            onClose(); // Đóng popup
            window.location.reload(); // Tải lại trang để cập nhật Header và Bản đồ
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user: username, passwd: password })
            });
            const data = await res.json();
            setLoading(false);

            if (res.ok) {
                alert("Đăng ký thành công!");
                setIsLogin(true);
            } else {
                alert(`❌ Lỗi: ${data.message}`);
            }
        } catch (error) {
            setLoading(false);
            alert("❌ Lỗi kết nối máy chủ!");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            {/* Click ra ngoài hộp để đóng */}
            <div className="absolute inset-0" onClick={onClose}></div>

            {/* Hộp thoại chính */}
            <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl border border-slate-100 relative z-10 animate-in fade-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold">
                    ✕
                </button>

                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-cyan-800">
                        {isLogin ? "Đăng Nhập" : "Tạo Tài Khoản Mới"}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        {isLogin ? "Hệ thống điều phối tàu hỏa" : "Mặc định (User)"}
                    </p>
                </div>

                <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Tài khoản</label>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800" placeholder="Nhập tên tài khoản..." required />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800" placeholder="Nhập mật khẩu..." required />
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2.5 rounded-xl transition disabled:bg-slate-400 text-sm shadow-md">
                        {loading ? "Đang xử lý..." : isLogin ? "Đăng Nhập" : "Đăng Ký"}
                    </button>
                </form>

                <div className="mt-4 pt-4 border-t border-slate-100 text-center text-xs">
                    {isLogin ? (
                        <p className="text-slate-600">
                            Bạn chưa có tài khoản?{" "}
                            <button onClick={() => { setIsLogin(false); setUsername(""); setPassword(""); }} className="text-cyan-600 font-bold hover:underline">
                                Đăng ký ngay
                            </button>
                        </p>
                    ) : (
                        <p className="text-slate-600">
                            Đã có tài khoản?{" "}
                            <button onClick={() => { setIsLogin(true); setUsername(""); setPassword(""); }} className="text-cyan-600 font-bold hover:underline">
                                Đăng nhập
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}