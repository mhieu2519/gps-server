// gps-map/app/admin/station/update/page.tsx
// Trang cập nhật dữ liệu tàu tại ga dành cho role supervisor (và admin test)
//
// Flow:
//   Mỗi POLL_INTERVAL_MS (10s) gọi GET /api/station/active-trains
//   API trả về: { isWindowOpen, windowClosesAt, trains: [{ma_tau, ma_chuyen_di, carriages}] }
//   Nếu isWindowOpen=true và có tàu → hiển thị form cập nhật từng tàu
//   Supervisor nhập liệu → POST /api/station/report
//   Khi windowClosesAt sắp đến → countdown hiển thị
//   Khi window đóng → khóa form

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BiStation } from "react-icons/bi";
import { LiaOpencart } from "react-icons/lia";
import { GiBunkBeds } from "react-icons/gi";
import { PiArmchairLight } from "react-icons/pi";
import { FcElectricalSensor } from "react-icons/fc";
import { GrTrain } from "react-icons/gr";
import { MdOutlineTimer, MdWarning } from "react-icons/md";
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { toast } from "react-toastify";

const POLL_INTERVAL_MS = 10_000; // polling mỗi 10 giây

//Typescript interfaces 

type TrangThaiToa = "binh_thuong" | "hong_nhe" | "hong_nang" | "ngung_hoat_dong";

interface CarriageState {
    ma_toa: string;
    thu_tu_toa: number;
    loai_toa: "KH_NGOI" | "KH_NAM" | "HANG_HOA";
    so_luong_thuc_te: number;
    khoi_luong_thuc_te: number;
    trang_thai: TrangThaiToa;
    ghi_chu: string;
}

interface TrainInfo {
    ma_tau: string;
    ma_chuyen_di: string | null;
    distance_m: number;
    speed: number;
    ten_ga_gan_nhat?: string | null;
    carriages: CarriageState[];
}

interface ApiResponse {
    ma_ga: string;
    ten_ga: string;
    detection_radius_m: number;
    window_grace_minutes: number;
    isWindowOpen: boolean;
    windowClosesAt: string | null;
    is_global_admin: boolean;
    trains: TrainInfo[];
    error?: string;
}

//  Helpers

function formatCountdown(ms: number): string {
    if (ms <= 0) return "00:00";
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function trangThaiLabel(t: TrangThaiToa): string {
    const map: Record<TrangThaiToa, string> = {
        binh_thuong: "Bình thường",
        hong_nhe: "Hỏng nhẹ",
        hong_nang: "Hỏng nặng",
        ngung_hoat_dong: "Ngừng hoạt động",
    };
    return map[t];
}

function trangThaiColor(t: TrangThaiToa): string {
    const map: Record<TrangThaiToa, string> = {
        binh_thuong: "text-emerald-600 bg-emerald-50 border-emerald-200",
        hong_nhe: "text-amber-600 bg-amber-50 border-amber-200",
        hong_nang: "text-red-600 bg-red-50 border-red-200",
        ngung_hoat_dong: "text-slate-500 bg-slate-100 border-slate-300",
    };
    return map[t];
}

//  Component chín
export default function StationUpdatePage() {
    const [apiData, setApiData] = useState<ApiResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [editMap, setEditMap] = useState<Record<string, CarriageState[]>>({});
    const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

    const [countdown, setCountdown] = useState<number>(0);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Dùng ref để fetchData không bị stale closure với submitted
    const submittedRef = useRef<Record<string, boolean>>({});

    // Theo dõi trạng thái cửa sổ trước đó để detect lúc mở lại
    const prevWindowOpenRef = useRef<boolean>(false);

    //  Fetch API
    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/station/active-trains");
            if (!res.ok) {
                const d = await res.json();
                setFetchError(d.error ?? "Lỗi kết nối server");
                return;
            }
            const data: ApiResponse = await res.json();
            setFetchError(null);
            setApiData(data);

            // Reset submitted + editMap khi cửa sổ vừa mở lại (false → true)
            if (data.isWindowOpen && !prevWindowOpenRef.current) {
                submittedRef.current = {};
                setSubmitted({});
                setEditMap({});
            }
            prevWindowOpenRef.current = data.isWindowOpen;

            // Khởi tạo editMap cho tàu chưa submit (dùng ref để tránh stale)
            setEditMap((prev) => {
                const next = { ...prev };
                for (const train of data.trains) {
                    if (!train.ma_tau || submittedRef.current[train.ma_tau]) continue;
                    if (!next[train.ma_tau]) {
                        next[train.ma_tau] = train.carriages.map((c) => ({ ...c }));
                    }
                }
                return next;
            });
        } catch {
            setFetchError("Không thể kết nối đến server.");
        } finally {
            setIsLoading(false);
        }
    }, []); // ← không depend submitted nữa, dùng ref

    // Polling
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Countdown timer — admin global không có windowClosesAt → không hiện
    useEffect(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (!apiData?.windowClosesAt) { setCountdown(0); return; }

        const update = () => {
            const ms = new Date(apiData.windowClosesAt!).getTime() - Date.now();
            setCountdown(Math.max(0, ms));
        };
        update();
        countdownRef.current = setInterval(update, 1000);
        return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }, [apiData?.windowClosesAt]);

    // Auto-chọn tàu đầu tiên khi có dữ liệu mới
    useEffect(() => {
        if (apiData?.trains?.length && !selectedTrain) {
            setSelectedTrain(apiData.trains[0].ma_tau);
        }
    }, [apiData, selectedTrain]);
    //  Handlers 

    const handleCarriageChange = (
        maTau: string,
        maToa: string,
        field: keyof CarriageState,
        value: string | number | TrangThaiToa
    ) => {
        setEditMap((prev) => ({
            ...prev,
            [maTau]: (prev[maTau] ?? []).map((c) =>
                c.ma_toa === maToa ? { ...c, [field]: value } : c
            ),
        }));
    };

    const handleSubmit = async (train: TrainInfo) => {
        if (!train.ma_chuyen_di) {
            toast.error("Tàu này chưa có mã chuyến đi, không thể cập nhật.");
            return;
        }
        const carriages = editMap[train.ma_tau];
        if (!carriages?.length) return;

        setSubmitting(train.ma_tau);
        try {
            const res = await fetch("/api/station/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ma_chuyen_di: train.ma_chuyen_di,
                    ma_tau: train.ma_tau,
                    carriages: carriages.map((c) => ({
                        ma_toa: c.ma_toa,
                        loai_toa: c.loai_toa,
                        so_luong_thuc_te: c.loai_toa !== "HANG_HOA" ? c.so_luong_thuc_te : undefined,
                        khoi_luong_thuc_te: c.loai_toa === "HANG_HOA" ? c.khoi_luong_thuc_te : undefined,
                        trang_thai_toa: c.trang_thai,
                        ghi_chu: c.ghi_chu,
                    })),
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`✅ ${data.message}`);
                // Cập nhật cả ref lẫn state cùng lúc
                submittedRef.current = { ...submittedRef.current, [train.ma_tau]: true };
                setSubmitted((p) => ({ ...p, [train.ma_tau]: true }));
            } else {
                toast.error(`❌ ${data.error}`);
            }
        } catch {
            toast.error("Lỗi kết nối server.");
        } finally {
            setSubmitting(null);
        }
    };
    //  Render UI

    const isWindowOpen = apiData?.isWindowOpen ?? false;

    // Loading ban đầu
    if (isLoading) {
        return (
            <div className="p-6 bg-slate-900 min-h-screen flex items-center justify-center text-slate-400">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-slate-500 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
                    Đang kết nối hệ thống định vị...
                </div>
            </div>
        );
    }

    // Lỗi cấu hình tài khoản
    if (fetchError && !apiData) {
        return (
            <div className="p-6 bg-slate-900 min-h-screen flex items-center justify-center">
                <div className="bg-red-900/30 border border-red-500 text-red-300 rounded-lg p-6 max-w-md text-center">
                    <FiAlertCircle className="text-4xl mx-auto mb-3" />
                    <p className="font-bold mb-1">Không thể tải dữ liệu</p>
                    <p className="text-sm">{fetchError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-900 min-h-screen text-slate-100">
            {/*  Header Ga  */}
            <div className="max-w-5xl mx-auto mb-4">
                <div className="bg-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-bold text-amber-400">
                            <BiStation className="text-2xl" />
                            Cổng Cập Nhật: {apiData?.ten_ga ?? "—"}
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            Phát hiện tàu trong bán kính {apiData?.detection_radius_m ?? 200}m ·
                            Ân hạn {apiData?.window_grace_minutes ?? 3} phút sau khi tàu rời ga ·
                            Cập nhật mỗi {POLL_INTERVAL_MS / 1000}s
                        </p>
                    </div>

                    {/* Đèn trạng thái */}
                    <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-xs font-bold flex-shrink-0 ${isWindowOpen
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500"
                        : "bg-red-500/20 text-red-400 border-red-500"
                        }`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${isWindowOpen ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                        {isWindowOpen ? "MỞ KHÓA" : "KHÓA"}
                    </div>
                </div>
            </div>

            {/*  Countdown  */}
            {isWindowOpen && apiData?.windowClosesAt && (
                <div className="max-w-5xl mx-auto mb-4">
                    <div className={`rounded-lg p-3 flex items-center gap-3 text-sm font-medium border ${countdown < 60_000
                        ? "bg-red-900/40 border-red-500 text-red-300"
                        : "bg-slate-800 border-slate-600 text-slate-300"
                        }`}>
                        <MdOutlineTimer className="text-xl flex-shrink-0" />
                        <span>
                            Cửa sổ cập nhật đóng sau:&nbsp;
                            <span className={`font-mono text-lg font-bold ${countdown < 60_000 ? "text-red-400" : "text-amber-400"}`}>
                                {formatCountdown(countdown)}
                            </span>
                        </span>
                        {countdown < 60_000 && (
                            <MdWarning className="text-red-400 ml-auto text-xl animate-pulse" />
                        )}
                    </div>
                </div>
            )}

            {/*  Không có tàu trong bán kính  */}
            {!isWindowOpen && (
                <div className="max-w-5xl mx-auto">
                    <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
                        <GrTrain className="text-5xl text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 font-medium">Hiện chưa có tàu nào trong ga</p>
                        <p className="text-slate-500 text-sm mt-1">
                            Form sẽ tự động mở khi có tàu tiến vào bán kính {apiData?.detection_radius_m ?? 200}m
                        </p>
                    </div>
                </div>
            )}

            {/*  Danh sách tàu đang dừng  */}
            {isWindowOpen && apiData?.trains && apiData.trains.length > 0 && (
                <div className="max-w-5xl mx-auto">
                    {/* Tab chọn tàu */}
                    {apiData.trains.length > 1 && (
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                            {apiData.trains.map((train) => (
                                <button
                                    key={train.ma_tau}
                                    onClick={() => setSelectedTrain(train.ma_tau)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0 transition border ${selectedTrain === train.ma_tau
                                        ? "bg-amber-500 text-slate-900 border-amber-400"
                                        : "bg-slate-800 text-slate-300 border-slate-600 hover:border-amber-400"
                                        }`}
                                >
                                    <GrTrain />
                                    {train.ma_tau}
                                    <span className="text-xs opacity-75 font-mono">
                                        ~{train.distance_m}m
                                    </span>
                                    {submitted[train.ma_tau] && (
                                        <FiCheckCircle className="text-emerald-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Panel tàu được chọn */}
                    {apiData.trains
                        .filter((t) => t.ma_tau === (selectedTrain ?? apiData.trains[0].ma_tau))
                        .map((train) => {
                            const carriages = editMap[train.ma_tau] ?? train.carriages;
                            const isSubmitted = submitted[train.ma_tau];

                            return (
                                <div key={train.ma_tau} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                    {/* Header tàu */}
                                    <div className="p-4 border-b border-slate-700 flex flex-wrap gap-4 items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                                <GrTrain /> {train.ma_tau}
                                                {isSubmitted && (
                                                    <span className="text-emerald-400 text-xs bg-emerald-900/30 border border-emerald-500 px-2 py-0.5 rounded-full">
                                                        ✓ Đã gửi
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Chuyến: <span className="font-mono text-slate-200">{train.ma_chuyen_di ?? "—"}</span>
                                                &nbsp;·&nbsp;Tốc độ: {train.speed} km/h
                                                {apiData?.is_global_admin
                                                    ? <>&nbsp;·&nbsp;Ga gần nhất: <span className="text-slate-200">{train.ten_ga_gan_nhat ?? "—"}</span></>
                                                    : <>&nbsp;·&nbsp;Cách ga: ~{train.distance_m}m</>
                                                }
                                            </p>
                                        </div>
                                        {!isSubmitted && (
                                            <button
                                                onClick={() => handleSubmit(train)}
                                                disabled={submitting === train.ma_tau || !train.ma_chuyen_di}
                                                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 disabled:text-slate-400 text-slate-950 font-bold py-2 px-5 rounded-lg text-sm transition"
                                            >
                                                <FcElectricalSensor className="text-xl" />
                                                {submitting === train.ma_tau ? "Đang gửi..." : "Gửi Bản Tin"}
                                            </button>
                                        )}
                                    </div>

                                    {/* Bảng toa */}
                                    {carriages.length === 0 ? (
                                        <p className="p-6 text-center text-slate-500 italic text-sm">
                                            Chuyến đi này chưa có danh sách toa hoặc chưa được lập tàu.
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase">
                                                    <tr>
                                                        <th className="px-4 py-2.5 text-left w-8">#</th>
                                                        <th className="px-4 py-2.5 text-left">Mã toa</th>
                                                        <th className="px-4 py-2.5 text-left">Loại</th>
                                                        <th className="px-4 py-2.5 text-center">Số lượng / Tải trọng</th>
                                                        <th className="px-4 py-2.5 text-center">Trạng thái</th>
                                                        <th className="px-4 py-2.5 text-left">Ghi chú sự cố</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700/60">
                                                    {carriages.map((c) => (
                                                        <tr
                                                            key={c.ma_toa}
                                                            className={isSubmitted ? "opacity-50" : ""}
                                                        >
                                                            {/* Số thứ tự */}
                                                            <td className="px-4 py-3 text-slate-500 text-xs">{c.thu_tu_toa}</td>

                                                            {/* Mã toa */}
                                                            <td className="px-4 py-3 font-mono font-bold text-slate-200">
                                                                {c.ma_toa}
                                                            </td>

                                                            {/* Loại toa */}
                                                            <td className="px-4 py-3 text-slate-400">
                                                                <span className="flex items-center gap-1">
                                                                    {c.loai_toa === "HANG_HOA" ? (
                                                                        <><LiaOpencart /> Hàng hóa</>
                                                                    ) : c.loai_toa === "KH_NAM" ? (
                                                                        <><GiBunkBeds /> Giường nằm</>
                                                                    ) : (
                                                                        <><PiArmchairLight /> Ghế ngồi</>
                                                                    )}
                                                                </span>
                                                            </td>

                                                            {/* Số lượng / Tải */}
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        disabled={isSubmitted}
                                                                        value={
                                                                            c.loai_toa === "HANG_HOA"
                                                                                ? c.khoi_luong_thuc_te
                                                                                : c.so_luong_thuc_te
                                                                        }
                                                                        onChange={(e) =>
                                                                            handleCarriageChange(
                                                                                train.ma_tau,
                                                                                c.ma_toa,
                                                                                c.loai_toa === "HANG_HOA"
                                                                                    ? "khoi_luong_thuc_te"
                                                                                    : "so_luong_thuc_te",
                                                                                parseFloat(e.target.value) || 0
                                                                            )
                                                                        }
                                                                        className="border border-slate-600 bg-slate-900 text-slate-100 rounded px-2 py-1 w-24 text-center font-bold focus:outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    />
                                                                    <span className="text-xs text-slate-500 w-10 text-left">
                                                                        {c.loai_toa === "HANG_HOA" ? "tấn" : "khách"}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* Trạng thái toa */}
                                                            <td className="px-4 py-3 text-center">
                                                                <select
                                                                    disabled={isSubmitted}
                                                                    value={c.trang_thai}
                                                                    onChange={(e) =>
                                                                        handleCarriageChange(
                                                                            train.ma_tau,
                                                                            c.ma_toa,
                                                                            "trang_thai",
                                                                            e.target.value as TrangThaiToa
                                                                        )
                                                                    }
                                                                    className={`text-xs font-semibold px-2 py-1 rounded border cursor-pointer focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${trangThaiColor(c.trang_thai)}`}
                                                                >
                                                                    <option value="binh_thuong">Bình thường</option>
                                                                    <option value="hong_nhe">Hỏng nhẹ</option>
                                                                    <option value="hong_nang">Hỏng nặng</option>
                                                                    <option value="ngung_hoat_dong">Ngừng HĐ</option>
                                                                </select>
                                                            </td>

                                                            {/* Ghi chú */}
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Ghi chú (nếu có)"
                                                                    disabled={isSubmitted}
                                                                    value={c.ghi_chu}
                                                                    onChange={(e) =>
                                                                        handleCarriageChange(
                                                                            train.ma_tau,
                                                                            c.ma_toa,
                                                                            "ghi_chu",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1 w-full text-xs placeholder-slate-600 focus:outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Cảnh báo đã submit */}
                                    {isSubmitted && (
                                        <div className="p-3 bg-emerald-900/20 border-t border-emerald-800 flex items-center gap-2 text-emerald-400 text-xs">
                                            <FiCheckCircle />
                                            Bản tin đã được gửi thành công. Dữ liệu đã được cập nhật vào hệ thống.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}

            {/* Không có tàu nhưng cửa sổ vẫn mở */}
            {isWindowOpen && apiData?.trains?.length === 0 && (
                <div className="max-w-5xl mx-auto">
                    <div className="bg-slate-800 rounded-xl p-6 border border-amber-600/40 text-center">
                        <MdOutlineTimer className="text-4xl text-amber-400 mx-auto mb-3" />
                        <p className="text-amber-300 font-medium">Tàu vừa rời bán kính ga</p>
                        <p className="text-slate-400 text-sm mt-1">
                            Cửa sổ cập nhật đóng sau <span className="font-mono text-amber-400">{formatCountdown(countdown)}</span>
                        </p>
                    </div>
                </div>
            )}

            {/* Cảnh báo lỗi polling (không làm mất UI) */}
            {fetchError && apiData && (
                <div className="max-w-5xl mx-auto mt-4">
                    <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-center gap-2 text-red-300 text-xs">
                        <FiAlertCircle />
                        Mất kết nối tạm thời: {fetchError}. Đang thử lại...
                    </div>
                </div>
            )}
        </div>
    );
}


