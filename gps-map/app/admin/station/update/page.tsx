"use client";

import { useState, useEffect } from "react";
import { BiStation } from "react-icons/bi";
import { LiaOpencart } from "react-icons/lia";
import { GiBunkBeds } from "react-icons/gi";
import { PiArmchairLight } from "react-icons/pi";
import { FcElectricalSensor } from "react-icons/fc";

interface CarriageUpdate {
    carriage_code: string;
    type: "KH_NGOI" | "KH_NAM" | "HANG_HOA";
    current_passenger_count: number;
    current_cargo_weight: number;
}

export default function StationUpdatePage() {
    // Giả định tài khoản này thuộc về "Ga Thanh Hóa"
    const stationName = "Ga Thanh Hóa";

    // Các trạng thái kết nối và kiểm tra GPS ngầm
    const [isTrainAtStation, setIsTrainAtStation] = useState(true); // Trạng thái tự động bật/tắt dựa trên GPS
    const [tripCode, setTripCode] = useState("SE1_2026_05_23");
    const [trainHead, setTrainHead] = useState("D19E-941");

    // Dữ liệu toa tàu thực tế
    const [carriages, setCarriages] = useState<CarriageUpdate[]>([
        { carriage_code: "TOA-01", type: "KH_NGOI", current_passenger_count: 64, current_cargo_weight: 0 },
        { carriage_code: "TOA-02", type: "KH_NAM", current_passenger_count: 28, current_cargo_weight: 0 },
        { carriage_code: "TOA-HANG-01", type: "HANG_HOA", current_passenger_count: 0, current_cargo_weight: 12.5 },
    ]);

    // CHỮA LỖI 1 & 2: Hàm xử lý thay đổi số liệu thống nhất với UI
    const handleValueChange = (code: string, value: number) => {
        setCarriages(prev => prev.map(c => {
            if (c.carriage_code === code) {
                return {
                    ...c,
                    // Nếu là toa hàng thì cập nhật trọng tải, nếu là toa khách thì cập nhật số người
                    current_passenger_count: c.type !== "HANG_HOA" ? value : c.current_passenger_count,
                    current_cargo_weight: c.type === "HANG_HOA" ? value : c.current_cargo_weight
                };
            }
            return c;
        }));
    };

    // Hàm gửi bản tin cập nhật lên server để ghi vào CSDL A
    const handleSubmitReport = async () => {
        if (!isTrainAtStation) {
            alert("Lỗi: Tàu đã rời ga hoặc chưa tới, không thể cập nhật dữ liệu!");
            return;
        }

        // Cấu trúc bản tin gửi lên API
        const payload = {
            station_name: stationName,
            trip_code: tripCode,
            updates: carriages
        };

        console.log("Bản tin từ Ga gửi lên CSDL A:", payload);
        alert(`[${stationName}] Đã gửi bản tin thành công! Dữ liệu chuyến đi đã được khóa và cập nhật.`);
    };

    return (
        <div className="p-6 bg-slate-900 min-h-screen text-slate-100">
            {/* THANH THÔNG TIN GA */}
            <div className="max-w-4xl mx-auto bg-slate-800 p-4 mb-6 flex justify-between items-center ">
                <div>
                    <h1 className="flex items-center gap-1 text-xl font-bold text-amber-400"><BiStation className="mr-2 text-xl" /> Cổng Cập Nhật Dữ Liệu: {stationName}</h1>
                    <p className="text-xs text-slate-400 mt-1">Hệ thống tự động đồng bộ hóa theo định vị GPS của đoàn tàu.( chưa kết nối về database)</p>
                </div>

                {/* ĐÈN BÁO TRẠNG THÁI GPS TỰ ĐỘNG KHÓA/MỞ CHỨC NĂNG */}
                <div className={`px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-xs ${isTrainAtStation ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500" : "bg-red-500/20 text-red-400 border border-red-500"
                    }`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${isTrainAtStation ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}></span>
                    {isTrainAtStation ? "MỞ KHÓA: TÀU ĐANG Ở TRONG GA" : "BỊ KHÓA: TÀU KHÔNG Ở TRONG GA"}
                </div>
            </div>

            {/* THÔNG TIN CHUYẾN TÀU ĐANG DỪNG */}
            <div className="max-w-4xl mx-auto bg-slate-800 p-5 mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Thông tin đoàn tàu hiện tại</h2>
                <div className="grid grid-cols-2 gap-4 text-sm bg-slate-900/50 p-3 rounded">
                    <div><span className="text-slate-500">Mã chuyến đi:</span> <span className="font-mono font-bold text-slate-200">{tripCode}</span></div>
                    <div><span className="text-slate-500">Mã đầu máy (GPS):</span> <span className="font-mono font-bold text-slate-200">{trainHead}</span></div>
                </div>

                {/* NÚT GIẢ LẬP ĐỂ TEST BIẾN IS_TRAIN_AT_STATION */}
                <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                    <span className="text-xs italic text-amber-500/80"> Test tính năng ngắt quyền:</span>
                    <button
                        type="button"
                        onClick={() => setIsTrainAtStation(!isTrainAtStation)}
                        className="bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 px-3 py-1.5 rounded border border-slate-600 transition"
                    >
                        {isTrainAtStation ? "Mô phỏng: Tàu chạy tiếp (Khóa giao diện)" : "Mô phỏng: Tàu vào ga (Mở giao diện)"}
                    </button>
                </div>
            </div>

            {/* DANH SÁCH TOA XE CẦN ĐIỀU CHỈNH SỐ LIỆU THỰC TẾ */}
            <div className="max-w-4xl mx-auto bg-slate-800 p-6 rounded-lg">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
                    Cập nhật lượng khách & hàng hóa thực tế rời ga
                </h2>

                {/* BẢNG NHẬP LIỆU THÔNG TIN TOA */}
                <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-4 py-3 text-left">Ký hiệu Toa</th>
                                <th className="px-4 py-3 text-left">Loại Toa</th>
                                <th className="px-4 py-3 text-right">Số lượng trước rời ga</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {carriages.map((c) => (
                                <tr key={c.carriage_code} className={!isTrainAtStation ? "bg-gray-50 opacity-50" : ""}>
                                    {/* Cột 1: Mã Toa */}
                                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{c.carriage_code}</td>

                                    {/* Cột 2: Loại Toa */}
                                    <td className="px-4 py-3 text-gray-500">
                                        <span className="flex items-center gap-1">
                                            {c.type === "HANG_HOA" ? (
                                                <>
                                                    <LiaOpencart className="mr-2" />
                                                    Toa hàng
                                                </>
                                            ) : c.type === "KH_NAM" ? (
                                                <>
                                                    <GiBunkBeds className="mr-2" />
                                                    Toa nằm
                                                </>
                                            ) : (
                                                <>
                                                    <PiArmchairLight className="mr-2" />
                                                    Toa ngồi
                                                </>
                                            )}
                                        </span>
                                    </td>

                                    {/* Cột 3: CHỮA LỖI VALUE ĐỘNG */}
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <input
                                                type="number"
                                                disabled={!isTrainAtStation}
                                                // Nếu là toa hàng thì lấy cân nặng thực tế, ngược lại lấy số lượng khách đặt
                                                value={c.type === "HANG_HOA" ? c.current_cargo_weight : c.current_passenger_count}
                                                onChange={(e) => handleValueChange(c.carriage_code, parseFloat(e.target.value) || 0)}
                                                className="border text-gray-900 border-gray-300 rounded px-2 py-1 w-24 text-center font-bold bg-gray-50 focus:bg-white focus:outline-blue-500 disabled:cursor-not-allowed"
                                            />
                                            <span className="text-xs text-gray-400 w-10 text-left">
                                                {c.type === "HANG_HOA" ? "tấn" : "khách"}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* NÚT ĐỒNG BỘ GỬI BẢN TIN */}
                <div className="flex justify-end mt-6 pt-4 border-slate-700/50">
                    <button
                        type="button"
                        disabled={!isTrainAtStation}
                        onClick={handleSubmitReport}
                        className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold py-3 px-6 rounded-lg text-sm transition shadow-md disabled:cursor-not-allowed"
                    >
                        <FcElectricalSensor className="mr-2 text-2xl " />
                        Gửi Bản Tin Cập Nhật
                    </button>
                </div>
            </div>
        </div>
    );
}