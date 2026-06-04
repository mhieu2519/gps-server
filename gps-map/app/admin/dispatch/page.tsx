// app/admin/dispatch/page.tsx
"use client";

import { useState, useEffect } from "react";
import { FiSave } from "react-icons/fi";
import { FcManager } from "react-icons/fc";
import { GrTrain } from "react-icons/gr";
import { BsBoxSeam } from "react-icons/bs";
import { GiWeight } from "react-icons/gi";
import { IoPeopleOutline } from "react-icons/io5";
import { PiEmptyBold } from "react-icons/pi";
import { LiaOpencart } from "react-icons/lia";
import { GiBunkBeds } from "react-icons/gi";
import { PiArmchairLight } from "react-icons/pi";
import { IoMdAddCircleOutline } from "react-icons/io";
import { FcDataConfiguration } from "react-icons/fc"
import { toast } from 'react-toastify';
// Interface cấu trúc Toa xe
interface Carriage {
    id: number;
    carriage_code: string;
    type: "KH_NGOI" | "KH_NAM" | "HANG_HOA";
    current_passenger_count: number;
    max_capacity: number;
    isActive: boolean;
    loai_toa?: string;
    ten_hang_hoa?: string;
    current_cargo_weight?: number;
    max_cargo_capacity?: number;
    don_vi?: string;
    trang_thai_hang?: string;
}

// Interface cấu trúc Lộ trình (Đọc từ DB)
interface RouteItem {
    ma_lo_trinh: string;
    ten_lo_trinh: string;
    danh_sach_ga: string[];
}

// Interface cấu trúc Ga tàu
interface StationItem {
    ma_ga: string;
    ten_ga: string;
}

// Interface cho Chuyến đi thực tế lấy từ bảng lịch trình
interface TripItem {
    ma_chuyen_di: string;
    ma_tau: string;
    ngay_chay: string;
    ma_dau_may: string;
    ma_lo_trinh: string | null;
    trang_thai: string;
}

export default function DispatchAdmin() {

    const [trips, setTrips] = useState<TripItem[]>([]); // Danh sách các chuyến đi từ bảng lịch trình
    const [selectedTrip, setSelectedTrip] = useState(""); // Mã chuyến đi đang chọn
    const [trainHead, setTrainHead] = useState(""); // Đầu máy tự động đồng bộ theo chuyến đi

    const [availableRoutes, setAvailableRoutes] = useState<RouteItem[]>([]); // Đọc ngược từ bảng lo_trinh
    const [selectedRoute, setSelectedRoute] = useState(""); // Mã lộ trình gán cho chuyến đi hiện tại
    const [stations, setStations] = useState<StationItem[]>([]); // Danh mục ga để thiết kế lộ trình

    // State cho khu vực thiết kế lộ trình mới
    const [newRouteCode, setNewRouteCode] = useState("");
    const [newRouteName, setNewRouteName] = useState("");
    const [selectedStations, setSelectedStations] = useState<string[]>([]); // Mảng lưu các mã ga theo thứ tự bấm

    // Cấu trúc đoàn tàu chính thức đang thiết lập
    const [trainLayout, setTrainLayout] = useState<Carriage[]>([]);
    // Kho chứa các toa hàng rảnh chờ điều phối
    const [availableCargoCarriages, setAvailableCargoCarriages] = useState<Carriage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // tải danh sách chuyến đi
    useEffect(() => {
        async function fetchInitialData() {
            try {
                // Gọi API lấy danh sách chuyến đi thực tế trong bảng lịch trình
                const res = await fetch("/api/dispatch/schedule/trips");
                const tripsData: TripItem[] = await res.json();

                if (tripsData && tripsData.length > 0) {
                    setTrips(tripsData);
                    // Chọn mặc định chuyến đi đầu tiên trong danh sách công việc
                    setSelectedTrip(tripsData[0].ma_chuyen_di);
                } else {
                    setIsLoading(false); // Nếu hoàn toàn không có chuyến đi nào
                }
            } catch (error) {
                console.error("❌ Lỗi tải danh sách chuyến đi thực tế:", error);
                setIsLoading(false);
            }
        }
        fetchInitialData();
    }, []);
    // Đồng bộ dữ liệu khi chọn chuyến đi
    useEffect(() => {
        if (!selectedTrip) return;

        async function fetchTrainData() {
            try {
                setIsLoading(true);

                // Tìm thông tin chuyến đi đang chọn trong danh sách chuyến đi hiện tại để lấy Đầu Máy mặc định trước
                const currentTripInfo = trips.find(t => t.ma_chuyen_di === selectedTrip);
                if (currentTripInfo) {
                    setTrainHead(currentTripInfo.ma_dau_may || "");
                    setSelectedRoute(currentTripInfo.ma_lo_trinh || "");
                }

                // Fetch dữ liệu liên quan từ DB
                const [passengerRes, cargoRes, routesRes, stationsRes] = await Promise.all([
                    fetch(`/api/dispatch/passenger?trip=${selectedTrip}`),
                    fetch(`/api/dispatch/available-cargo`),
                    fetch(`/api/dispatch/routes`),
                    fetch(`/api/dispatch/stations`)
                ]);

                const passengerData = await passengerRes.json();
                const cargoData = await cargoRes.json();
                const routesData = await routesRes.json();
                const stationsData = await stationsRes.json();

                // cập nhật danh mục lộ trình & ga lên State
                setAvailableRoutes(routesData || []);
                setStations(stationsData || []);

                // khi trong DB của chuyến đi này đã có gán sẵn lộ trình, cập nhật lại 
                if (passengerData.ma_lo_trinh) {
                    setSelectedRoute(passengerData.ma_lo_trinh);
                } else if (currentTripInfo?.ma_lo_trinh) {
                    setSelectedRoute(currentTripInfo.ma_lo_trinh);
                } else {
                    setSelectedRoute("");
                }

                // Map dữ liệu từ bảng du_lieu_dat_ve sang cấu trúc Frontend
                const rawCarriages = Array.isArray(passengerData) ? passengerData : (passengerData.carriages ?? []);
                const mappedPassengers: Carriage[] = (rawCarriages || []).map((item: any) => ({
                    id: item.id,
                    carriage_code: item.ma_toa,
                    type: item.loai_toa,
                    current_passenger_count: item.so_luong_thuc_te || 0,
                    max_capacity: item.suc_chua_toi_da || 0,
                    isActive: item.is_active !== undefined ? item.is_active : true,
                }));

                // Map dữ liệu từ bảng du_lieu_tau_hang sang cấu trúc Frontend
                const mappedCargos: Carriage[] = (cargoData || []).map((item: any) => ({
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
    }, [selectedTrip, trips]);

    // Hàm gọi tải lại riêng danh mục lộ trình sau khi lưu mới
    const refreshRoutes = async () => {
        const res = await fetch(`/api/dispatch/routes`);
        const data = await res.json();
        setAvailableRoutes(data || []);
    };

    // Bật/Tắt trạng thái hoạt động của toa khách
    const toggleCarriageActive = (id: number) => {
        setTrainLayout(prev =>
            prev.map(c => (c.id === id ? { ...c, isActive: !c.isActive } : c))
        );
    };

    // Móc thêm toa hàng thực tế vào đuôi đoàn tàu
    const handleAddCargoCarriage = (carriage: Carriage) => {
        setTrainLayout([...trainLayout, carriage]);
        setAvailableCargoCarriages(availableCargoCarriages.filter(c => c.id !== carriage.id));
    };

    // Gỡ bỏ toa hàng khỏi đoàn tàu trả lại kho
    const handleRemoveCargoCarriage = (id: number) => {
        const carriage = trainLayout.find(c => c.id === id);
        if (carriage) {
            setAvailableCargoCarriages([...availableCargoCarriages, carriage]);
            setTrainLayout(trainLayout.filter(c => c.id !== id));
        }
    };

    // Lưu cấu hình lập đoàn tàu và cập nhật trạng thái
    const handleSaveLayout = async () => {
        try {
            const response = await fetch("/api/dispatch/save-layout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    selectedTrip,
                    trainHead, // Lưu mã đầu máy (có thể đã chỉnh sửa thủ công nếu đổi đầu máy đứt xích)
                    ma_lo_trinh: selectedRoute,
                    layout: trainLayout
                })
            });

            if (response.ok) {
                toast.success(
                    ` Đã cập nhật đầu máy [${trainHead}] và lộ trình cho chuyến ${selectedTrip}!`,
                );
                // Cập nhật lại state local danh sách trips để đồng bộ giao diện ngay lập tức
                setTrips(prev => prev.map(t => t.ma_chuyen_di === selectedTrip ? { ...t, ma_dau_may: trainHead, ma_lo_trinh: selectedRoute } : t));
            } else {
                toast.error(" Lỗi khi lưu cấu hình lập tàu.");
            }
        } catch (error) {
            console.error("Lỗi kết nối API:", error);
        }
    };

    // chọn ga tạo lộ trình mới
    const handleAddStationToNewRoute = (maGa: string) => {
        if (selectedStations.includes(maGa)) return;
        setSelectedStations([...selectedStations, maGa]);
    };

    const handleRemoveStationFromNewRoute = (indexToRemove: number) => {
        setSelectedStations(selectedStations.filter((_, index) => index !== indexToRemove));
    };

    const handleSaveNewRoute = async () => {
        if (!newRouteCode || !newRouteName || selectedStations.length === 0) {
            toast.warning("Vui lòng nhập đủ thông tin!");
            return;
        }

        try {
            const res = await fetch("/api/dispatch/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ma_lo_trinh: newRouteCode,
                    ten_lo_trinh: newRouteName,
                    danh_sach_ga: selectedStations
                })
            });

            if (res.ok) {

                toast.success("Tạo lộ trình mới thành công!");
                setNewRouteCode("");
                setNewRouteName("");
                setSelectedStations([]);
                refreshRoutes();
            } else {
                toast.error("Có lỗi xảy ra khi lưu lộ trình.");
            }
        } catch (error) {
            console.error("Lỗi lưu lộ trình:", error);
        }
    };

    if (isLoading && trips.length === 0) {
        return <div className="p-6 text-center text-sm font-medium text-gray-500">⏳ Đang đọc danh sách lịch trình chuyến đi thực tế từ Database...</div>;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto font-sans text-gray-800">

            {/* thanh điều hướng */}
            <div className="flex justify-between items-center border-b pb-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"> <FcManager /> <span>Quản Lý Lập Tàu Kỹ Thuật</span></h1>
                    <p className="text-xs text-gray-500 mt-0.5">Hệ thống đồng bộ lịch chạy thực tế, phân phối đầu máy GPS và móc nối toa hàng.</p>
                </div>
                <button
                    onClick={handleSaveLayout}
                    className="flex items-center bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-1 px-4 rounded text-sm transition shadow-sm"
                >
                    <FiSave className="mr-2" />
                    Lưu Cấu Hình
                </button>
            </div>

            {/* thông tin chuyến đi*/}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">

                {/* chọn chuyến đi */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mã Chuyến Đi (Từ Lịch Trình)</label>
                    <select
                        className="border border-gray-300 rounded p-1.5 text-sm bg-white font-semibold w-full focus:outline-none text-gray-900"
                        value={selectedTrip}
                        onChange={(e) => setSelectedTrip(e.target.value)}
                    >
                        {trips.length === 0 ? (
                            <option value="">-- Trống (Hãy tạo lịch chạy trước) --</option>
                        ) : (
                            trips.map((trip) => (
                                <option key={trip.ma_chuyen_di} value={trip.ma_chuyen_di}>
                                    {trip.ma_chuyen_di}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                {/* chọn lộ trình */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gán Lộ Trình Hành Trình</label>
                    <select
                        className="border border-gray-300 rounded p-1.5 text-sm bg-white font-semibold text-cyan-800 w-full focus:outline-none"
                        value={selectedRoute}
                        onChange={(e) => setSelectedRoute(e.target.value)}
                    >
                        <option value="">-- Chưa gắn lộ trình --</option>
                        {availableRoutes.map((route) => (
                            <option key={route.ma_lo_trinh} value={route.ma_lo_trinh}>
                                📍 {route.ten_lo_trinh} ({route.ma_lo_trinh})
                            </option>
                        ))}
                    </select>
                </div>

                {/* đầu máy */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Đầu Máy Cấp Phát (Định vị GPS)</label>
                    <input
                        type="text"
                        className="border border-gray-300 rounded p-1.5 text-sm font-mono w-full bg-white text-amber-600 font-bold"
                        value={trainHead}
                        onChange={(e) => setTrainHead(e.target.value)}
                        placeholder="Nhập mã đầu máy (Ví dụ: D19E-941)"
                    />
                </div>
            </div>

            {/* sơ đồ đoàn tàu trực quan */}
            <div className="mb-6">
                <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2">Thứ tự các toa trên ray thực tế</h2>
                <div className="flex items-center gap-2 p-2 bg-gray-900 overflow-x-auto min-h-[130px] rounded-lg">

                    {/* Đầu máy động */}
                    <div className="w-32 h-24 bg-amber-500 text-white rounded-lg flex flex-col justify-between p-2 flex-shrink-0 text-xs border-b-4 border-amber-700">
                        <span className="font-bold text-[10px] ml-2 flex items-center gap-1"><GrTrain className="text-lg mr-2 " /> ĐẦU MÁY</span>
                        <span className="font-mono text-[10px] bg-black/20 p-0.5 rounded truncate">{trainHead || "CHƯA CÓ"}</span>
                        <span className="text-[9px] text-amber-200">VỊ TRÍ: #0</span>
                    </div>

                    {/* Danh sách các toa xe */}
                    {isLoading ? (
                        <div className="text-gray-400 text-xs my-auto pl-4">⏳ Đang kết nối sơ đồ toa...</div>
                    ) : trainLayout.map((c, index) => (
                        <div key={`${c.carriage_code}-${index}`} className="flex items-center flex-shrink-0">
                            <div className="w-4 h-1 bg-gray-600"></div>

                            <div className={`w-40 h-24 rounded-lg flex flex-col justify-between p-2 text-white text-xs relative border-b-4 transition ${!c.isActive
                                ? "bg-gray-800 border-gray-950 opacity-30"
                                : (c.type === "HANG_HOA" || !!c.ten_hang_hoa)
                                    ? "bg-emerald-600 border-emerald-800"
                                    : "bg-sky-600 border-sky-800"
                                }`}>
                                <div className="flex justify-between items-center font-mono font-bold text-[10px]">
                                    <span>{c.carriage_code}</span>
                                    {(c.type === "HANG_HOA" || !!c.ten_hang_hoa) && (
                                        <button
                                            onClick={() => handleRemoveCargoCarriage(c.id)}
                                            className="text-gray-300 hover:text-red-400 font-bold text-sm"
                                        >✕</button>
                                    )}
                                </div>


                                <div className="text-[10px] leading-tight text-gray-100">
                                    {(c.type === "HANG_HOA" || !!c.ten_hang_hoa) ? (
                                        <div>
                                            <div className="font-medium truncate flex items-center gap-1">
                                                <BsBoxSeam className="mr-2" /> {c.ten_hang_hoa || "Hàng hóa"}
                                            </div>
                                            <div className="text-[9px] text-emerald-200">
                                                {c.current_cargo_weight || 0}/{c.max_cargo_capacity || 0} {c.don_vi || "tấn"}
                                            </div>
                                        </div>
                                    ) : c.current_passenger_count > 0 ? (
                                        <div className="flex items-center gap-1">
                                            <IoPeopleOutline className="mr-2" /> {c.current_passenger_count} khách
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <PiEmptyBold className="mr-2" /> Toa trống
                                        </div>
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

            {/* khu vực điều phối chi tiết */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                {/* bảng điều chỉnh các toa đã lập */}
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
                                        {(c.type === "HANG_HOA" || !!c.ten_hang_hoa) ? (
                                            <span className="flex items-center gap-1 text-emerald-700 font-medium"> <LiaOpencart className="mr-2" /> Hàng hóa: {c.ten_hang_hoa}</span>
                                        ) : c.type === "KH_NAM" ? (
                                            <div className="flex items-center gap-1">
                                                <GiBunkBeds className="mr-2" /> Toa giường nằm
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <PiArmchairLight className="mr-2" /> Toa ghế ngồi
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-gray-700">
                                        {(c.type === "HANG_HOA" || !!c.ten_hang_hoa) ? (
                                            <span className="text-emerald-600">{c.current_cargo_weight} / {c.max_cargo_capacity} {c.don_vi}</span>
                                        ) : (
                                            `${c.current_passenger_count} / ${c.max_capacity}`
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {(c.type === "HANG_HOA" || !!c.ten_hang_hoa) ? (
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
                            {!isLoading && trainLayout.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-6 text-gray-400 italic">Chuyến đi này chưa được thiết lập bất kỳ toa tàu nào.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* kho toa hàng */}
                <div className="border rounded-lg bg-white shadow-sm p-3">
                    <div className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-2 flex items-center ">
                        <BsBoxSeam className="mr-2" /> Toa Hàng Mới Trong Kho
                    </div>
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
                                <div className="flex items-center gap-3 text-[11px] text-gray-600 border-t border-dashed pt-1">
                                    <div className="inline-flex items-center gap-1">
                                        <BsBoxSeam />
                                        <b>{c.ten_hang_hoa}</b>
                                    </div>
                                    <div className="inline-flex items-center gap-1">
                                        <GiWeight />
                                        <span>Nặng: {c.current_cargo_weight}/{c.max_cargo_capacity} {c.don_vi}</span>
                                    </div>
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

            {/* khu vực thiết kế lộ trình */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <div className="border-b pb-2 mb-4">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <FcDataConfiguration className="mr-1 text-2xl" />
                        Khu Vực Thiết Kế Lộ Trình Hành Trình
                    </h3>
                    <p className="text-xs text-gray-400">Chọn các ga theo thứ tự tàu chạy để định nghĩa tuyến đường mới.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mã Lộ Trình Mới</label>
                        <input
                            type="text"
                            placeholder="Ví dụ: LT_HN_SG, LT_HN_HP..."
                            className="w-full border border-gray-300 p-2 rounded text-xs font-mono focus:outline-none"
                            value={newRouteCode}
                            onChange={e => setNewRouteCode(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên Gọi Tuyến Đường</label>
                        <input
                            type="text"
                            placeholder="Ví dụ: Tuyến Thống Nhất Bắc Nam, Tuyến Hà Nội - Hải Phòng"
                            className="w-full border border-gray-300 p-2 rounded text-xs focus:outline-none"
                            value={newRouteName}
                            onChange={e => setNewRouteName(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Danh Sách Ga Sẵn Có (Click để thêm)</p>
                        <div className="border border-gray-200 rounded-lg h-44 overflow-y-auto p-2.5 bg-gray-50 flex flex-wrap gap-1.5 content-start">
                            {stations.map((ga) => (
                                <button
                                    key={ga.ma_ga}
                                    type="button"
                                    onClick={() => handleAddStationToNewRoute(ga.ma_ga)}
                                    className="flex items-center bg-white hover:bg-cyan-50 hover:border-cyan-400 border border-gray-300 rounded px-2 py-1 text-xs font-medium text-gray-700 shadow-sm transition"
                                >
                                    <IoMdAddCircleOutline className="mr-1" />
                                    {ga.ten_ga} ({ga.ma_ga})
                                </button>
                            ))}
                            {stations.length === 0 && <p className="text-gray-400 text-xs italic m-auto">Không tìm thấy dữ liệu ga nào trong CSDL...</p>}
                        </div>
                    </div>

                    <div>
                        <p className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider mb-2">Hành Trình Ga Qua Đi (Theo Thứ Tự Tuyến Đường)</p>
                        <div className="border border-cyan-100 rounded-lg h-44 overflow-y-auto p-2 bg-cyan-50/20 flex flex-col gap-1.5">
                            {selectedStations.map((maGa, index) => {
                                const stationInfo = stations.find((s) => s.ma_ga === maGa);
                                return (
                                    <div key={`${maGa}-${index}`} className="flex items-center justify-between bg-white px-3 py-1.5 rounded border border-cyan-200 text-xs shadow-sm">
                                        <span className="font-medium text-gray-800">
                                            <b className="text-cyan-600 mr-2">#{index + 1}</b> {stationInfo?.ten_ga || maGa} <span className="text-[10px] text-gray-400 font-mono">({maGa})</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveStationFromNewRoute(index)}
                                            className="text-red-500 hover:text-red-700 font-bold px-1"
                                        >✕</button>
                                    </div>
                                );
                            })}
                            {selectedStations.length === 0 && (
                                <p className="text-gray-400 text-xs italic m-auto text-center">Chưa chọn ga hành trình. Hãy chọn các ga ở bảng bên trái theo thứ tự di chuyển.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={handleSaveNewRoute}
                        className="flex items-center bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded shadow-sm transition"
                    >
                        <FiSave className="mr-2" />
                        Lưu Lộ Trình
                    </button>
                </div>
            </div>

        </div>
    );
}