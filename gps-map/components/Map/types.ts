// components/Map/types.ts
export interface ToaTau {
    ma_toa: string;
    loai: string;      // Hành khách, Hàng hóa
    kieu: string;      // Víp, Ghế mềm, Than, Dầu...
    tai_trong: number; // Số người hoặc khối lượng
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

    danh_sach_ga_chi_tiet?: StationDetails[];
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
