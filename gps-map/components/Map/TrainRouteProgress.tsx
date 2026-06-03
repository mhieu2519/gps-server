// gps-server/gps-map/components/Map/TrainRouteProgress.tsx
// hiển thị tiến độ lộ trình của tàu, dựa trên dữ liệu tuyến đường và vị trí hiện tại của tàu
import { useEffect, useRef } from "react";
import { FcMindMap, FcRating } from "react-icons/fc";

// tính khoảng cách giữa 2 điểm (lat1, lng1) và (lat2, lng2) bằng công thức Haversine
// Hàm tính khoảng cách giữa tọa độ tàu và ga (mét) để định vị tàu đang ở đâu
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Bán kính Trái Đất tính bằng mét
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
    // Ref để lưu trữ ga gần nhất đã xác định được, tránh việc tính toán lại quá nhiều lần khi vị trí tàu cập nhật liên tục
    const currentStationRef = useRef<HTMLDivElement | null>(null);
    if (!routeStations || routeStations.length === 0) return null;

    const totalStations = routeStations.length;

    // TÍNH TOÁN TIẾN ĐỘ 

    // Tìm ga gần nhất để kiểm tra xem có đang đỗ trong ga nào không
    let absoluteClosestIdx = 0;
    let minDistanceToAnyStation = Infinity;

    routeStations.forEach((station, index) => {
        const dist = getHaversineDistance(currentLat, currentLng, station.lat, station.lng);
        if (dist < minDistanceToAnyStation) {
            minDistanceToAnyStation = dist;
            absoluteClosestIdx = index;
        }
    });

    // Nếu khoảng cách đến bất kỳ ga nào < 800m -> Đang đỗ tại ga đó
    const isAtStation = minDistanceToAnyStation < 800;

    // Tính toán vị trí phần trăm (0 - 100%) thực tế của tàu trên toàn tuyến
    let progressPercent = 0;
    let nextStationIndex = 0;

    if (isAtStation) {
        // Nếu đang đỗ ở ga, tiến độ bằng chính vị trí của ga đó trên thanh đồ thị
        progressPercent = totalStations > 1 ? (absoluteClosestIdx / (totalStations - 1)) * 100 : 100;
        nextStationIndex = absoluteClosestIdx;
    } else {
        // Nếu tàu đang chạy giữa các khu gian, tìm xem tàu đang nằm giữa Ga nào và Ga nào
        let segmentIdx = 0; // Mặc định giả định nằm ở phân đoạn đầu tiên (Ga 0 -> Ga 1)
        let minSegmentScore = Infinity;

        for (let i = 0; i < totalStations - 1; i++) {
            const stA = routeStations[i];
            const stB = routeStations[i + 1];

            // Khoảng cách từ tàu tới Ga trước và Ga sau
            const distToA = getHaversineDistance(currentLat, currentLng, stA.lat, stA.lng);
            const distToB = getHaversineDistance(currentLat, currentLng, stB.lat, stB.lng);
            const totalSegmentDist = getHaversineDistance(stA.lat, stA.lng, stB.lat, stB.lng);

            // Điểm số phân đoạn: Tổng khoảng cách từ tàu tới 2 ga trừ đi khoảng cách thực tế giữa 2 ga
            // Phân đoạn nào có sai số nhỏ nhất chính là phân đoạn tàu đang chạy qua
            const score = (distToA + distToB) - totalSegmentDist;

            if (score < minSegmentScore) {
                minSegmentScore = score;
                segmentIdx = i;
            }
        }

        // Tính chi tiết tỷ lệ phần trăm tàu đã đi được trong phân đoạn [segmentIdx -> segmentIdx + 1]
        const stationA = routeStations[segmentIdx];
        const stationB = routeStations[segmentIdx + 1];
        const distFromA = getHaversineDistance(currentLat, currentLng, stationA.lat, stationA.lng);
        const distToB = getHaversineDistance(currentLat, currentLng, stationB.lat, stationB.lng);

        // Tỷ lệ đi được trong phân đoạn hiện tại (Ví dụ: đi được 40% đoạn đường từ Ga A đến Ga B)
        const segmentProgress = distFromA / (distFromA + distToB);

        // Quy đổi ra tiến độ tổng của toàn bộ hành trình tuyến
        const basePercent = (segmentIdx / (totalStations - 1)) * 100;
        const segmentWeight = (1 / (totalStations - 1)) * 100;
        progressPercent = basePercent + (segmentProgress * segmentWeight);

        // Tàu đang di chuyển giữa khu gian thì ga tiếp theo chắc chắn là Ga B (segmentIdx + 1)
        nextStationIndex = segmentIdx + 1;
    }

    useEffect(() => {
        if (currentStationRef.current) {
            currentStationRef.current.scrollIntoView({
                behavior: "smooth", // Cuộn mượt mà chống giật hình
                block: "nearest",   // Giữ nguyên vị trí cuộn theo chiều dọc Y
                inline: "center"    // Đẩy ga hiện tại nằm chính giữa khung nhìn ngang X
            });
        }
    }, [nextStationIndex, isAtStation]); // Kích hoạt cuộn lại mỗi khi tàu chuyển khu gian hoặc dừng/đi

    return (
        <div className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 my-3 select-none">
            <div className="flex justify-between items-center mb-2">
                <span className="flex items-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <FcMindMap className="mr-2 text-xl" /> Tiến độ lộ trình
                </span>
                <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200">
                    {isAtStation
                        ? `Đang đỗ: ${routeStations[absoluteClosestIdx].ten_ga}`
                        : `Sắp tiến vào: ${routeStations[nextStationIndex].ten_ga}`}
                </span>
            </div>

            {/* Thanh ngang lộ trình */}
            <div className="relative w-full px-3 overflow-x-auto overflow-y-hidden flex items-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

                <div className="relative flex items-center justify-between w-full">
                    {/* Đường nối ray nền xám cố định */}
                    <div className="absolute left-[7px] right-[7px] top-1/2 -translate-y-1/2 h-1 bg-gray-200 rounded z-0"></div>

                    {/* Đường tiến độ màu xanh chạy MƯỢT MÀ theo vị trí thực của tàu */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 h-1 bg-blue-500 rounded -z-10 transition-all duration-700 ease-out z-20"
                        style={{
                            left: '12px',
                            width: `calc((100% - 24px) * ${progressPercent} / 100)`

                        }}
                    ></div>

                    {/* Vòng tròn các Ga */}
                    {routeStations.map((station, idx) => {
                        // Xác định trạng thái trực quan cho từng Ga nút tròn
                        let isPassed = false;
                        let isCurrent = false;

                        if (isAtStation) {
                            isPassed = idx < absoluteClosestIdx;
                            isCurrent = idx === absoluteClosestIdx;
                        } else {
                            // Nếu tàu đang chạy giữa đường: Các ga có index nhỏ hơn ga sắp tới đều là đã qua
                            isPassed = idx < nextStationIndex;
                            isCurrent = idx === nextStationIndex; // Làm sáng ga tiếp theo đang đợi tàu đến
                        }

                        return (
                            <div
                                key={station.ma_ga}
                                ref={isCurrent ? currentStationRef : null}
                                className="flex flex-col items-center relative flex-shrink-0 "

                            >
                                {/* Điểm nút ga */}
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 text-[10px] font-mono font-bold transition-all duration-500 ${isCurrent && isAtStation
                                    ? "bg-amber-500 border-amber-600 text-white scale-125 shadow-md animate-pulse"
                                    : isCurrent && !isAtStation
                                        ? "bg-blue-500 border-blue-600 text-white scale-110 animate-bounce" // Nhún nhảy ở ga đích đang đợi tàu gel
                                        : isPassed
                                            ? "bg-blue-500 border-blue-600 text-white"
                                            : "bg-white border-gray-300 text-gray-400"
                                    }`}>
                                    {isCurrent ? <FcRating /> : idx + 1}
                                </div>

                                {/* Tên Ga */}
                                <div className="absolute top-7 flex flex-col items-center text-center w-full">
                                    <span className={`text-[10px] font-bold line-clamp-2 text-center block leading-tight transition-all ${isCurrent && isAtStation
                                        ? "text-amber-600 font-extrabold"
                                        : isCurrent && !isAtStation
                                            ? "text-blue-600 font-extrabold animate-pulse"
                                            : isPassed
                                                ? "text-blue-500"
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

            {/* Tạo khoảng cách đệm phía dưới */}
            <div className="h-3"></div>
        </div>
    );
}