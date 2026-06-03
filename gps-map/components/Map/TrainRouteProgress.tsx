// gps-server/gps-map/components/Map/TrainRouteProgress.tsx
import { useEffect, useRef } from "react";
import { FcMindMap, FcRating } from "react-icons/fc";

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

interface StationDetails {
    ma_ga: string;
    ten_ga: string;
    lat: number;
    lng: number;
}

export default function TrainRouteProgress({
    currentLat,
    currentLng,
    routeStations
}: {
    currentLat: number;
    currentLng: number;
    routeStations: StationDetails[]
}) {
    const currentStationRef = useRef<HTMLDivElement | null>(null);
    if (!routeStations || routeStations.length === 0) return null;

    const totalStations = routeStations.length;

    // Tính toán tiến độ
    let absoluteClosestIdx = 0;
    let minDistanceToAnyStation = Infinity;

    routeStations.forEach((station, index) => {
        const dist = getHaversineDistance(currentLat, currentLng, station.lat, station.lng);
        if (dist < minDistanceToAnyStation) {
            minDistanceToAnyStation = dist;
            absoluteClosestIdx = index;
        }
    });
    // Nếu có biến currentSpeed truyền vào từ props:
    // const isAtStation = minDistanceToAnyStation < 200 && currentSpeed < 5;
    const isAtStation = minDistanceToAnyStation < 200; // Ngưỡng 200m để xác định "đang đỗ tại ga"
    let progressPercent = 0;
    let nextStationIndex = 0;

    if (isAtStation) {
        progressPercent = totalStations > 1 ? (absoluteClosestIdx / (totalStations - 1)) * 100 : 100;
        nextStationIndex = absoluteClosestIdx;
    } else {
        let segmentIdx = 0;
        let minSegmentScore = Infinity;

        for (let i = 0; i < totalStations - 1; i++) {
            const stA = routeStations[i];
            const stB = routeStations[i + 1];
            const distToA = getHaversineDistance(currentLat, currentLng, stA.lat, stA.lng);
            const distToB = getHaversineDistance(currentLat, currentLng, stB.lat, stB.lng);
            const totalSegmentDist = getHaversineDistance(stA.lat, stA.lng, stB.lat, stB.lng);
            const score = (distToA + distToB) - totalSegmentDist;

            if (score < minSegmentScore) {
                minSegmentScore = score;
                segmentIdx = i;
            }
        }

        const stationA = routeStations[segmentIdx];
        const stationB = routeStations[segmentIdx + 1];
        const distFromA = getHaversineDistance(currentLat, currentLng, stationA.lat, stationA.lng);
        const distToB = getHaversineDistance(currentLat, currentLng, stationB.lat, stationB.lng);
        const segmentProgress = distFromA / (distFromA + distToB);

        const basePercent = (segmentIdx / (totalStations - 1)) * 100;
        const segmentWeight = (1 / (totalStations - 1)) * 100;
        progressPercent = basePercent + (segmentProgress * segmentWeight);
        nextStationIndex = segmentIdx + 1;
    }

    useEffect(() => {
        if (currentStationRef.current) {
            currentStationRef.current.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center"
            });
        }
    }, [nextStationIndex, isAtStation]);

    // Định dạng độ rộng cố định cho mỗi phân đoạn ga để chống dồn chữ khi cuộn ngang
    const stationWidth = 68;
    const centerOffset = stationWidth / 2;

    const timelineWidth = (totalStations - 1) * stationWidth;
    const trackWidth = timelineWidth - centerOffset * 2;

    const progressWidth = (trackWidth * progressPercent) / 100;

    return (
        <div className="w-full bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm my-3 select-none">
            {/* Header trạng thái */}
            <div className="flex justify-between items-center mb-4">
                <span className="flex items-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <FcMindMap className="mr-1.5 text-lg" /> Tiến độ lộ trình
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${isAtStation
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>
                    {isAtStation
                        ? `Đang đỗ: ${routeStations[absoluteClosestIdx].ten_ga}`
                        : `Sắp tiến vào: ${routeStations[nextStationIndex].ten_ga}`}
                </span>
            </div>

            {/* Khung cuộn ngang mượt mà, cấp thêm padding-bottom để không bị cắt chữ tên ga */}
            <div className="w-full overflow-x-auto pb-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div
                    className="relative flex items-center"
                    style={{ width: `${timelineWidth + 40}px`, margin: '0 auto' }}
                >
                    {/* Đường ray xám nền */}
                    <div
                        className="absolute h-1 bg-gray-100 rounded z-0"
                        style={{
                            left: `${centerOffset}px`,
                            // right: `${centerOffset}px`,
                            width: `${trackWidth}px`,
                            top: '12px'
                        }}
                    ></div>

                    {/* Thanh tiến độ màu xanh chạy động */}
                    <div
                        className="absolute h-1 bg-blue-500 rounded z-10 transition-all duration-700 ease-out"
                        style={{
                            left: `${centerOffset}px`,
                            top: '12px',
                            width: `${progressWidth}px`
                        }}
                    ></div>

                    {/* Vòng lặp danh sách các Ga */}
                    {routeStations.map((station, idx) => {
                        let isPassed = false;
                        let isCurrent = false;

                        if (isAtStation) {
                            isPassed = idx < absoluteClosestIdx;
                            isCurrent = idx === absoluteClosestIdx;
                        } else {
                            isPassed = idx < nextStationIndex;
                            isCurrent = idx === nextStationIndex;
                        }

                        return (
                            <div
                                key={station.ma_ga}
                                ref={isCurrent ? currentStationRef : null}
                                className="flex flex-col items-center relative z-20 transition-all duration-300"
                                style={{
                                    width: `${stationWidth}px`,
                                    marginRight: idx === totalStations - 1 ? 0 : '0px'
                                }}
                            >
                                {/* Nút tròn Ga */}
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 text-[8px] font-bold transition-all duration-500 bg-white ${isCurrent && isAtStation
                                    ? "border-amber-500 text-amber-600 scale-110 shadow-md ring-4 ring-amber-100"
                                    : isCurrent && !isAtStation
                                        ? "border-blue-500 text-blue-600 scale-110 shadow-md ring-4 ring-blue-100"
                                        : isPassed
                                            ? "border-blue-500 bg-blue-50 text-blue-600"
                                            : "border-gray-200 text-gray-400"
                                    }`}>
                                    {isCurrent ? (
                                        <FcRating className="text-base animate-pulse" />
                                    ) : (
                                        <span>{idx + 1}</span>
                                    )}
                                </div>

                                {/* Nhãn tên Ga nằm cố định phía dưới nút */}
                                <div className="absolute top-10 flex flex-col items-center text-center w-[120px]">
                                    <span className={`text-[11px] font-semibold tracking-tight line-clamp-2 text-center leading-tight transition-colors duration-300 ${isCurrent && isAtStation
                                        ? "text-amber-600 font-bold"
                                        : isCurrent && !isAtStation
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