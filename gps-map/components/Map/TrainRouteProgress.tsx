// gps-server/gps-map/components/Map/TrainRouteProgress.tsx
// phương án 1: tiến độ bằng đường chim bay giải thytaat Haversine, không phụ thuộc vào tốc độ hiện tại (vì có thể tàu đang tạm dừng giữa đường). 
// Tính toán này sẽ cho phép xác định chính xác hơn vị trí tàu trên lộ trình, đặc biệt khi tàu đang di chuyển giữa các ga hoặc đang tạm dừng tại ga mà không có tín hiệu tốc độ rõ ràng.
// nhược d
// chuyển qua phương án 2: 

import { useEffect, useRef } from "react";
import { FcMindMap, FcRating } from "react-icons/fc";

interface StationDetails {
    ma_ga: string;
    ten_ga: string;
    lat: number;
    lng: number;
}

interface TrainProgressProps {
    routeStations: StationDetails[];
    // Nhận trực tiếp cụm object socketData bám ray từ Backend bắn về
    socketData: {
        current_segment: string;
        next_station_code: string;
        segment_progress: number;    // Tiến độ mượt 0.0 -> 1.0 thực tế của riêng đoạn đó
        distance_left_meters: number;
        eta_minutes: number;
        is_at_station: boolean;
    }
}

export default function TrainRouteProgress({ routeStations, socketData }: TrainProgressProps) {
    const currentStationRef = useRef<HTMLDivElement | null>(null);

    if (!routeStations || routeStations.length === 0 || !socketData) return null;

    const totalStations = routeStations.length;
    const { next_station_code, segment_progress, eta_minutes, is_at_station, distance_left_meters } = socketData;

    // Xác định vị trí Index của ga tiếp theo trong mảng hành trình cụ thể của chuyến đi
    let nextStationIdx = routeStations.findIndex(st => st.ma_ga.trim() === next_station_code.trim());

    // Nếu không tìm thấy, thử tìm theo cặp mã trong current_segment (Ví dụ: "HN-LB")
    if (nextStationIdx === -1) {
        nextStationIdx = routeStations.findIndex(st => next_station_code.includes(st.ma_ga.trim()));
    }
    if (nextStationIdx === -1) nextStationIdx = 0;

    // Xác định ga vừa đi qua (ga trước của phân đoạn hiện tại trên UI)
    // Nếu nextStationIdx là ga đầu tiên (0), ga trước đó cũng là 0. Ngược lại là nextStationIdx - 1.
    const lastStationIdx = nextStationIdx > 0 ? nextStationIdx - 1 : 0;

    // Tính toán phần trăm tiến độ tổng thể trên toàn tuyến
    let progressPercent = 0;
    if (is_at_station) {
        progressPercent = totalStations > 1 ? (nextStationIdx / (totalStations - 1)) * 100 : 100;
    } else {
        // Tỷ lệ phần trăm nền tính từ ga xuất phát đến ga vừa đi qua
        const basePercent = (lastStationIdx / (totalStations - 1)) * 100;
        // Trọng số của riêng phân đoạn hiện tại trên tổng thể hành trình
        const segmentWeight = (1 / (totalStations - 1)) * 100;

        // Tiến độ mượt bám theo đoạn ray hiện tại
        progressPercent = basePercent + (segment_progress * segmentWeight);
    }

    // Giới hạn giá trị trong khoảng từ 0% đến 100% để tránh tràn giao diện
    progressPercent = Math.min(100, Math.max(0, progressPercent));
    // Tự động cuộn ngang màn hình mượt mà theo ga hiện tại
    useEffect(() => {
        if (currentStationRef.current) {
            currentStationRef.current.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center"
            });
        }
    }, [nextStationIdx, is_at_station]);

    // Cấu hình đồ họa UI thanh Timeline
    const stationWidth = 68;
    const centerOffset = stationWidth / 2;
    const timelineWidth = totalStations * stationWidth;
    const trackWidth = timelineWidth - stationWidth;
    const progressWidth = (trackWidth * progressPercent) / 100;

    return (
        <div className="w-full bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm my-3 select-none">
            {/* Header hiển thị Real-time thông số đếm ngược thời gian */}
            <div className="flex justify-between items-center mb-4">
                <span className="flex items-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <FcMindMap className="mr-1.5 text-lg" /> Tiến độ lộ trình
                </span>

                <div className="flex gap-2">
                    {!is_at_station && eta_minutes > 0 && (
                        <span className="text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-full">
                            Còn {(distance_left_meters / 1000).toFixed(1)} km - Dự kiến: {Math.ceil(eta_minutes)} phút
                        </span>
                    )}
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${is_at_station
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                        {is_at_station
                            ? `Đang đỗ tại: ${routeStations[nextStationIdx]?.ten_ga || next_station_code}`
                            : `Sắp tiến vào: ${routeStations[nextStationIdx]?.ten_ga || next_station_code}`}
                    </span>
                </div>
            </div>

            {/* Khung cuộn ngang đồ họa tiến độ chạy tàu */}
            <div className="w-full overflow-x-auto pb-8 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="relative flex items-center" style={{ width: `${timelineWidth}px`, margin: "0 auto" }}>

                    {/* Đường ray xám nền */}
                    <div
                        className="absolute h-1 bg-gray-100 rounded z-0"
                        style={{
                            left: `${centerOffset}px`,
                            width: `${trackWidth}px`,
                            top: '12px'
                        }}
                    ></div>

                    {/* Thanh tiến độ màu xanh bám sát theo PostGIS */}
                    <div
                        className="absolute h-1 bg-blue-500 rounded z-10 transition-all duration-700 ease-out"
                        style={{
                            left: `${centerOffset}px`,
                            top: '12px',
                            width: `${progressWidth}px`
                        }}
                    ></div>

                    {/* Danh sách các Ga dọc hành trình */}
                    {routeStations.map((station, idx) => {
                        let isPassed = false;
                        let isCurrent = false;

                        if (is_at_station) {
                            isPassed = idx < nextStationIdx;
                            isCurrent = idx === nextStationIdx;
                        } else {
                            isPassed = idx <= lastStationIdx;
                            isCurrent = idx === nextStationIdx;
                        }

                        return (
                            <div
                                key={station.ma_ga}
                                ref={isCurrent ? currentStationRef : null}
                                className="flex flex-col items-center relative z-20 transition-all duration-300"
                                style={{ width: `${stationWidth}px` }}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 text-[8px] font-bold transition-all duration-500 bg-white ${isCurrent && is_at_station
                                    ? "border-amber-500 text-amber-600 scale-110 shadow-md ring-4 ring-amber-100"
                                    : isCurrent && !is_at_station
                                        ? "border-blue-500 text-blue-600 scale-110 shadow-md ring-4 ring-blue-100"
                                        : isPassed
                                            ? "border-blue-500 bg-blue-50 text-blue-600"
                                            : "border-gray-200 text-gray-400"
                                    }`}>
                                    {isCurrent ? (
                                        <FcRating className="text-base animate-pulse" />
                                    ) : (
                                        <span className={isPassed ? "text-blue-600" : "text-gray-400"}>{idx + 1}</span>
                                    )}
                                </div>

                                <div className="absolute top-10 flex flex-col items-center text-center w-[120px]">
                                    <span className={`text-[11px] font-semibold tracking-tight line-clamp-2 text-center leading-tight transition-colors duration-300 ${isCurrent && is_at_station
                                        ? "text-amber-600 font-bold"
                                        : isCurrent && !is_at_station
                                            ? "text-blue-600 font-bold"
                                            : isPassed
                                                ? "text-gray-700"
                                                : "text-gray-400"
                                        }`}>
                                        {station.ten_ga}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}