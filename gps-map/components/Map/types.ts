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
}

export interface HistoryData {
    path: [number, number][];
    startTime: number;
    deltas: number[];
}