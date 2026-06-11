// components/Map/types.ts
export interface ToaTau {
    ma_toa: string;
    loai: string;      // Hành khách, Hàng hóa
    kieu: string;      // Víp, Ghế mềm, Than, Dầu...
    tai_trong: number; // Số người hoặc khối lượng
}
export interface SocketDataProgress {
    current_segment: string;
    next_station_code: string;
    segment_progress: number;
    distance_left_meters: number;
    eta_minutes: number;
    is_at_station: boolean;
}
export interface DeviceStatus {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    battery: number;
    signal: number;
    timestamp: number;
    danh_sach_toa: ToaTau[];
    vibration?: number; // Dữ liệu rung từ cảm biến
    alert?: string; // Thông báo cảnh báo nếu có
    danh_sach_ga_chi_tiet?: StationDetails[];
    socketData?: SocketDataProgress; // Thông tin tiến độ bám ray từ socket
}

export interface HistoryData {
    path: [number, number][];
    startTime: number;
    deltas: number[];
}
// Định nghĩa cấu trúc của 1 Ga trong lộ trình
export interface StationDetails {
    ma_ga: string;
    ten_ga: string;
    lat: number;
    lng: number;
}
