// app/admin/dispatch/schedule/page.tsx
"use client";

import { useState, useEffect } from "react";
import { FcPlus, FcPlanner, FcSurvey, FcHighPriority, FcApproval, FcEmptyTrash } from "react-icons/fc";
import { FcFullTrash } from "react-icons/fc";


interface Trip {
    ma_chuyen_di: string;
    ma_tau: string;
    ngay_chay: string;
    ma_dau_may: string | null;
    ma_lo_trinh: string | null;
    trang_thai: string;
}

export default function SchedulePage() {
    // State cho Form
    const [maTau, setMaTau] = useState("SE1");
    const [ngayChay, setNgayChay] = useState("");

    // State danh sách hiển thị
    const [trips, setTrips] = useState<Trip[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    // Tải danh sách lịch chạy hiện tại
    const fetchSchedules = async () => {
        try {
            const res = await fetch("/api/dispatch/schedule/trips");
            const data = await res.json();
            setTrips(data || []);
        } catch (error) {
            console.error("Lỗi khi tải lịch chạy tàu:", error);
        }
    };
    // xóa
    const handleDelete = async (maChuyenDi: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa chuyến đi ${maChuyenDi}?`)) return;

        try {
            const res = await fetch("/api/dispatch/schedule/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ma_chuyen_di: maChuyenDi }),
            });
            const data = await res.json();
            if (res.ok) {
                alert("Xóa thành công!");
                fetchSchedules(); // Reset lại bảng
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert("Lỗi kết nối server");
        }
    };
    useEffect(() => {
        // Đặt ngày mặc định cho ô Input là ngày hôm nay
        const today = new Date().toISOString().split("T")[0];
        setNgayChay(today);
        fetchSchedules();
    }, []);

    // Xử lý Thêm lịch chạy
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ngayChay) {
            setMessage({ type: "error", text: "Vui lòng chọn ngày chạy tàu!" });
            return;
        }

        setIsLoading(true);
        setMessage({ type: "", text: "" });

        try {
            const res = await fetch("/api/dispatch/schedule/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ma_tau: maTau, ngay_chay: ngayChay }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: "success", text: <FcApproval className="mr-2" /> + ` Tạo thành công chuyến đi: ${data.ma_chuyen_di}` });
                fetchSchedules(); // Tải lại danh sách
            } else {
                setMessage({ type: "error", text: data.error || "Có lỗi xảy ra khi tạo lịch chạy." });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Không thể kết nối đến máy chủ." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto bg-gray-50 min-h-screen">
            <h1 className="flex items-center xt-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FcSurvey className="text-xl" />
                Thiết Lập Lịch Chạy Tàu Hàng Ngày
            </h1>

            {/* Khối Form Thêm Mới */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-8">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">Tạo Chuyến Đi Mới</h2>

                <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1 w-48">
                        <label className="text-sm font-medium text-gray-600">Mác Tàu (Mã Tàu)</label>
                        <input
                            type="text"
                            value={maTau}
                            onChange={(e) => setMaTau(e.target.value)}
                            placeholder="Nhập mác tàu (VD: SE1, HP1...)"
                            className="border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                        />
                    </div>

                    <div className="flex flex-col gap-1 w-48">
                        <label className="text-sm font-medium text-gray-600">Ngày Chạy Tàu</label>
                        <input
                            type="date"
                            value={ngayChay}
                            onChange={(e) => setNgayChay(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-5 py-2.5 rounded shadow-sm transition disabled:bg-gray-400"
                    >
                        {isLoading ? "Đang xử lý..." : <FcPlus /> + " Tạo Chuyến Đi"}
                    </button>
                </form>

                {message.text && (
                    <div className={`mt-4 p-3 rounded text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* Khối Danh Sách Lịch Trình Hiện Có */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-100 font-semibold text-gray-700">
                    <FcPlanner />
                    Danh Sách Các Chuyến Đi Đã Thiết Lập
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                                <th className="p-3">Mã Chuyến Đi</th>
                                <th className="p-3">Mác Tàu</th>
                                <th className="p-3">Ngày Chạy</th>
                                <th className="p-3">Đầu Máy Gán</th>
                                <th className="p-3">Lộ Trình Gán</th>
                                <th className="p-3 text-center">Trạng Thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trips.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-gray-400 italic">Hiện tại chưa có lịch chạy tàu nào được thiết lập.</td>
                                </tr>
                            ) : (
                                trips?.map((trip) => (
                                    <tr key={trip.ma_chuyen_di} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                        <td className="p-3 font-mono font-bold text-blue-600">{trip.ma_chuyen_di}</td>
                                        <td className="p-3 font-medium text-gray-700">{trip.ma_tau}</td>
                                        <td className="p-3 text-gray-600">{new Date(trip.ngay_chay).toLocaleDateString('vi-VN')}</td>
                                        <td className="p-3 font-mono text-gray-500">{trip.ma_dau_may || <FcHighPriority /> + " Chưa gán"}</td>
                                        <td className="p-3 font-mono text-gray-500">{trip.ma_lo_trinh || <FcHighPriority /> + " Chưa gán"}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${trip.trang_thai === 'CHO_LAP_TAU' ? 'bg-amber-100 text-amber-700' :
                                                trip.trang_thai === 'SAN_SANG' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {trip.trang_thai === 'CHO_LAP_TAU' ? '⏳ Chờ lập tàu' : '✅ Sẵn sàng'}
                                            </span>
                                            <button
                                                onClick={() => handleDelete(trip.ma_chuyen_di)}
                                                className="flex items-center text-red-500 hover:text-red-700 font-medium text-xs border border-red-200 hover:border-red-500 rounded px-2 py-1 transition"
                                            >
                                                <FcEmptyTrash className="mr-1" />
                                                <span className="ml-1"> Xóa</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}