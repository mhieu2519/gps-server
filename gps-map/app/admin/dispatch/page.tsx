"use client";

import { useState, useEffect } from "react";

// 1. Mở rộng Interface khớp hoàn toàn với cấu trúc DB mới của cả tàu khách và tàu hàng
interface Carriage {
    id: number;
    carriage_code: string;
    type: "KH_NGOI" | "KH_NAM" | "HANG_HOA";
    current_passenger_count: number;
    max_capacity: number;
    isActive: boolean;
    // Các trường đặc thù cho tàu hàng mới bổ sung
    loai_toa?: string;
    ten_hang_hoa?: string;
    current_cargo_weight?: number;
    max_cargo_capacity?: number;
    don_vi?: string;
    trang_thai_hang?: string;
}

export default function DispatchAdmin() {
    const [selectedTrip, setSelectedTrip] = useState("SE1_2026_05_23");
    const [trainHead, setTrainHead] = useState("D19E-941");

    // Sơ đồ đoàn tàu chính thức đang thiết lập
    const [trainLayout, setTrainLayout] = useState<Carriage[]>([]);

    // Kho chứa các toa hàng thô vừa nhận từ EMQX (chờ điều phối)
    const [availableCargoCarriages, setAvailableCargoCarriages] = useState<Carriage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 2. Fetch dữ liệu thực tế từ API Backend (Next.js API Routes )
    useEffect(() => {
        async function fetchTrainData() {
            try {
                setIsLoading(true);
                // Gọi API lấy dữ liệu toa khách dựa theo chuyến đi được chọn
                const passengerRes = await fetch(`/api/dispatch/passenger?trip=${selectedTrip}`);
                const passengerData = await passengerRes.json();

                // Gọi API lấy danh sách các toa hàng thô đang rảnh trong kho DB (chưa processed)
                const cargoRes = await fetch(`/api/dispatch/available-cargo`);
                const cargoData = await cargoRes.json();

                // Map dữ liệu từ bảng du_lieu_dat_ve sang cấu trúc Frontend
                const mappedPassengers: Carriage[] = passengerData.map((item: any) => ({
                    id: item.id,
                    carriage_code: item.ma_toa,
                    type: item.loai_toa,
                    current_passenger_count: item.so_luong_thuc_te,
                    max_capacity: item.suc_chua_toi_da,
                    isActive: item.is_active,
                }));

                // Map dữ liệu từ bảng du_lieu_tau_hang sang cấu trúc Frontend
                const mappedCargos: Carriage[] = cargoData.map((item: any) => ({
                    id: item.id,
                    carriage_code: item.ma_toa,
                    type: item.loai_toa,
                    current_passenger_count: 0,
                    max_capacity: 0,
                    isActive: true,
                    ten_hang_hoa: item.ten_hang_hoa,
                    current_cargo_weight: item.khoi_luong_thuc_te,
                    max_cargo_capacity: item.khoi_luong_toida,
                    don_vi: item.don_vi || "tấn",
                    trang_thai_hang: item.trang_thai
                }));

                setTrainLayout(mappedPassengers);
                setAvailableCargoCarriages(mappedCargos);
            } catch (error) {
                console.error("❌ Lỗi khi tải dữ liệu điều phối từ DB:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchTrainData();
    }, [selectedTrip]); // Tự động reload lại cấu trúc khi đổi mã chuyến đi

    // Nghiệp vụ 1: Bật/Tắt trạng thái hoạt động của toa khách
    const toggleCarriageActive = (id: number) => {
        setTrainLayout(prev =>
            prev.map(c => (c.id === id ? { ...c, isActive: !c.isActive } : c))
        );
    };

    // Nghiệp vụ 2: Móc thêm toa hàng thực tế vào đuôi đoàn tàu
    const handleAddCargoCarriage = (carriage: Carriage) => {
        setTrainLayout([...trainLayout, carriage]);
        setAvailableCargoCarriages(availableCargoCarriages.filter(c => c.id !== carriage.id));
    };

    // Nghiệp vụ 3: Gỡ bỏ toa hàng khỏi đoàn tàu trả lại kho
    const handleRemoveCargoCarriage = (id: number) => {
        const carriage = trainLayout.find(c => c.id === id);
        if (carriage) {
            setAvailableCargoCarriages([...availableCargoCarriages, carriage]);
            setTrainLayout(trainLayout.filter(c => c.id !== id));
        }
    };

    // Nghiệp vụ 4: Lưu cấu hình lập đoàn tàu và cập nhật trạng thái `is_processed = true` cho toa hàng
    const handleSaveLayout = async () => {
        try {
            const response = await fetch("/api/dispatch/save-layout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    selectedTrip,
                    trainHead,
                    layout: trainLayout
                })
            });

            if (response.ok) {
                alert(`💾 [DATABASE] Đã lưu cấu hình thành công cho đoàn tàu ${selectedTrip}!`);
            } else {
                alert("❌ Lỗi khi lưu cấu hình lập tàu.");
            }
        } catch (error) {
            console.error("Lỗi kết nối API:", error);
        }
    };

    if (isLoading) {
        return <div className="p-6 text-center text-sm font-medium text-gray-500">⏳ Đang đồng bộ dữ liệu thực tế từ Database...</div>;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto font-sans text-gray-800">

            {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG */}
            <div className="flex justify-between items-center border-b pb-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">🎛️ Quản Lý Thiết Lập Đoàn Tàu</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Kiểm tra sơ đồ khách từ hệ thống vé và phân phối thêm toa hàng hóa.</p>
                </div>
                <button
                    onClick={handleSaveLayout}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded text-sm transition shadow-sm"
                >
                    💾 Lưu Cấu Hình Lập Tàu
                </button>
            </div>

            {/* THÔNG TIN CHUYẾN ĐI & ĐẦU MÁY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mã Chuyến Đi</label>
                    <select
                        className="border border-gray-300 rounded p-1.5 text-sm bg-white font-medium w-full focus:outline-none"
                        value={selectedTrip}
                        onChange={(e) => setSelectedTrip(e.target.value)}
                    >
                        <option value="SE1_2026_05_23">Tàu SE1 (Hà Nội - Sài Gòn)</option>
                        <option value="HP2_2026_05_23">Tàu HP2 (Hải Phòng - Hà Nội)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Đầu Máy (Gắn định vị GPS)</label>
                    <input
                        type="text"
                        className="border border-gray-300 rounded p-1.5 text-sm font-mono w-full bg-white"
                        value={trainHead}
                        onChange={(e) => setTrainHead(e.target.value)}
                    />
                </div>
            </div>

            {/* SƠ ĐỒ ĐOÀN TÀU VẬT LÝ TRỰC QUAN */}
            <div className="mb-6">
                <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2">Thứ tự các toa trên ray (Thời gian thực)</h2>
                <div className="flex items-center gap-2 p-4 border rounded-xl bg-gray-900 overflow-x-auto min-h-[130px]">

                    {/* Đầu máy cố định */}
                    <div className="w-32 h-24 bg-amber-500 text-white rounded-lg flex flex-col justify-between p-2 flex-shrink-0 text-xs border-b-4 border-amber-700">
                        <span className="font-black">🚂 ĐẦU MÁY</span>
                        <span className="font-mono text-[10px] bg-black/20 p-0.5 rounded truncate">{trainHead}</span>
                        <span className="text-[9px] text-amber-200">VỊ TRÍ: #0</span>
                    </div>

                    {/* Danh sách các toa xe */}
                    {trainLayout.map((c, index) => (
                        <div key={`${c.carriage_code}-${index}`} className="flex items-center flex-shrink-0">
                            <div className="w-4 h-1 bg-gray-600"></div> {/* Móc nối */}

                            <div className={`w-40 h-24 rounded-lg flex flex-col justify-between p-2 text-white text-xs relative border-b-4 transition ${!c.isActive
                                ? "bg-gray-800 border-gray-950 opacity-30"
                                : c.type === "HANG_HOA"
                                    ? "bg-emerald-600 border-emerald-800"
                                    : "bg-sky-600 border-sky-800"
                                }`}>
                                <div className="flex justify-between items-center font-mono font-bold text-[10px]">
                                    <span>{c.carriage_code}</span>
                                    {c.type === "HANG_HOA" && (
                                        <button
                                            onClick={() => handleRemoveCargoCarriage(c.id)}
                                            className="text-gray-300 hover:text-red-400 font-bold text-sm"
                                        >×</button>
                                    )}
                                </div>

                                {/* THAY ĐỔI: Hiển thị thông tin hàng hóa động từ DB */}
                                <div className="text-[10px] leading-tight text-gray-100">
                                    {c.type === "HANG_HOA" ? (
                                        <div>
                                            <div className="font-medium truncate">📦 {c.ten_hang_hoa}</div>
                                            <div className="text-[9px] text-emerald-200">{c.current_cargo_weight}/{c.max_cargo_capacity} {c.don_vi}</div>
                                        </div>
                                    ) : c.current_passenger_count > 0 ? (
                                        `👥 ${c.current_passenger_count} khách`
                                    ) : (
                                        "🫙 Toa trống"
                                    )}
                                </div>

                                <div className="flex justify-between items-center text-[9px] text-gray-300 font-medium">
                                    <span>#{index + 1}</span>
                                    <span className="uppercase text-[8px] bg-black/20 px-1 rounded">
                                        {c.type === "HANG_HOA" ? (c.trang_thai_hang || "chờ") : (!c.isActive ? "TẮT" : "BẬT")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* KHU VỰC ĐIỀU PHỐI CHI TIẾT */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* BẢNG ĐIỀU CHỈNH CÁC TOA ĐÃ LẬP */}
                <div className="md:col-span-2 border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="bg-gray-50 p-3 border-b text-xs font-bold text-gray-500 uppercase">Danh sách chi tiết cấu trúc đoàn tàu</div>
                    <table className="min-w-full text-sm divide-y">
                        <thead className="bg-gray-50 text-gray-400 text-xs font-semibold">
                            <tr>
                                <th className="px-4 py-2 text-left">Mã Toa</th>
                                <th className="px-4 py-2 text-left">Loại / Nội Dung</th>
                                <th className="px-4 py-2 text-center">Tải Trọng / Khách</th>
                                <th className="px-4 py-2 text-right">Hành Động Trạng Thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                            {trainLayout.map((c, index) => (
                                <tr key={`${c.id}-${index}`} className={!c.isActive ? "bg-gray-50 text-gray-400" : ""}>
                                    <td className="px-4 py-3 font-mono font-bold">{c.carriage_code}</td>
                                    <td className="px-4 py-3">
                                        {c.type === "HANG_HOA" ? (
                                            <span className="text-emerald-700 font-medium">🛒 Hàng hóa: {c.ten_hang_hoa}</span>
                                        ) : c.type === "KH_NAM" ? (
                                            "🛏️ Toa giường nằm"
                                        ) : (
                                            "🪑 Toa ghế ngồi"
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-gray-700">
                                        {c.type === "HANG_HOA" ? (
                                            <span className="text-emerald-600">{c.current_cargo_weight} / {c.max_cargo_capacity} {c.don_vi}</span>
                                        ) : (
                                            `${c.current_passenger_count} / ${c.max_capacity}`
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {c.type === "HANG_HOA" ? (
                                            <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">Đã móc nối đuôi</span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => toggleCarriageActive(c.id)}
                                                className={`px-2 py-1 rounded text-[11px] font-bold transition ${c.isActive
                                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                                    }`}
                                            >
                                                {c.isActive ? "🔴 Ngắt hoạt động" : "🟢 Kích hoạt lại"}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* KHO TOA HÀNG DỰ PHÒNG THỰC TẾ (ĐỌC TỪ EMQX LOGS TRONG DB) */}
                <div className="border rounded-lg bg-white shadow-sm p-3">
                    <div className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-2">📦 Toa Hàng Mới Trong Kho</div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {availableCargoCarriages.map((c) => (
                            <div key={c.id} className="p-2 border rounded bg-gray-50 flex flex-col justify-between gap-2 text-xs">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-mono font-bold text-gray-900 text-sm">{c.carriage_code}</span>
                                        <span className="text-[10px] text-gray-400 block italic">Loại: {c.loai_toa}</span>
                                    </div>
                                    <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-medium uppercase">
                                        {c.trang_thai_hang}
                                    </span>
                                </div>
                                <div className="text-[11px] text-gray-600 border-t border-dashed pt-1">
                                    <div>📦 <b>{c.ten_hang_hoa}</b></div>
                                    <div>⚖️ Nặng: {c.current_cargo_weight} / {c.max_cargo_capacity} {c.don_vi}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleAddCargoCarriage(c)}
                                    className="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 rounded text-[11px] transition"
                                >
                                    + Móc nối vào đuôi tàu
                                </button>
                            </div>
                        ))}
                        {availableCargoCarriages.length === 0 && (
                            <p className="text-xs text-gray-400 italic text-center py-4">Chưa có bản tin toa hàng nào mới từ EMQX, bãi kho rỗng.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}