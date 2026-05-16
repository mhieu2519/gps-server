// components/map/Map.tsx

"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, WMSTileLayer, LayerGroup, LayersControl, ZoomControl, Tooltip } from "react-leaflet";
import { useEffect, useState, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotatedmarker";

import { DeviceStatus, HistoryData } from "./types";
import styles from "./Map.module.css";

import { GestureHandling } from 'leaflet-gesture-handling';
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css';
import { io } from "socket.io-client";
// Đăng ký plugin Leaflet
L.Map.addInitHook('addHandler', 'gestureHandling', GestureHandling);

// Fix icon Leaflet mặc định
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker.png",
});

const trainIcon = L.icon({
    iconUrl: '/train.png',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -20],
});
const startIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const endIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
// Component điều khiển Camera bản đồ
function MapController({ center, bounds }: { center: [number, number] | null, bounds: L.LatLngBoundsExpression | null }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50], animate: true });
        } else if (center) {
            map.flyTo(center, 16, { animate: true, duration: 1.5 });
        }
    }, [center, bounds, map]);
    return null;
}

export default function MapDashboard() {
    const [devices, setDevices] = useState<Record<string, DeviceStatus>>({});
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedDevicePos, setSelectedDevicePos] = useState<[number, number] | null>(null);
    const [activeSessionPath, setActiveSessionPath] = useState<[number, number][] | null>(null);
    const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedWagon, setSelectedWagon] = useState<any>(null);

    const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]); // Mặc định là hôm nay
    // gọi lại mỗi khi filterDate thay đổi
    useEffect(() => {
        const fetchSessions = async () => {
            const res = await fetch(`/api/trains/history?date=${filterDate}`);
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        };
        if (activeTab === 'history') {
            fetchSessions();
        }
    }, [filterDate, activeTab]);

    useEffect(() => {
        //const socket = io("http://localhost:4000");
        const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;
        const socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"], // Ưu tiên websocket
            withCredentials: true
        });
        socket.on("train_update", (data: any) => {
            setDevices((prev) => ({
                ...prev,
                [data.ma_tau]: {
                    ...prev[data.ma_tau],
                    lat: Number(data.lat),
                    lng: Number(data.lng),
                    speed: Number(data.speed),
                    heading: Number(data.heading),

                    battery: data.payload?.battery || prev[data.ma_tau]?.battery,
                    signal: data.payload?.signal || prev[data.ma_tau]?.signal
                }
            }));
        });

        return () => { socket.disconnect(); };
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Nếu sidebar đang mở và vị trí click không nằm trong sidebarRef
            if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setIsSidebarOpen(false);
            }
        }

        // Đăng ký sự kiện click toàn trang
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Hủy sự kiện khi component bị unmount để tránh rác bộ nhớ
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isSidebarOpen]);

    // Tải danh sách Sessions (Lịch sử) - Chỉ chạy 1 lần
    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const res = await fetch("/api/trains/history");
                if (res.ok) setSessions(await res.json());
            } catch (e) { console.error("Lỗi tải sessions:", e); }
        };
        fetchSessions();
    }, []);

    // Tải vị trí Realtime - Chạy mỗi 5 giây
    const loadRealtimeData = useCallback(async () => {
        try {
            const res = await fetch("/api/trains/status");
            if (res.ok) {
                const data = await res.json();
                setDevices(data);
            }
        } catch (error) {
            console.error("Lỗi cập nhật vị trí:", error);
        }
    }, []);

    useEffect(() => {
        loadRealtimeData();
        const interval = setInterval(loadRealtimeData, 5000);
        return () => clearInterval(interval);
    }, [loadRealtimeData]);

    // Xử lý xem lại lịch sử
    const handleViewHistory = async (sessionId: string) => {
        try {
            const res = await fetch(`/api/trains/history?session_id=${sessionId}`);
            const data = await res.json();
            if (data.path && data.path.length > 0) {
                setActiveSessionPath(data.path); // Vẽ Polyline lên map
                setMapBounds(L.latLngBounds(data.path).pad(0.1));
            }
        } catch (e) { console.error("Lỗi tải lịch sử hành trình:", e); }
    };

    return (
        <div className={styles.container}>

            {/* Nút mở lại Sidebar (hiện ra khi sidebar đang đóng) */}
            {!isSidebarOpen && (
                <button className={styles.openSidebarBtn} onClick={() => setIsSidebarOpen(true)}>
                    ☰
                </button>
            )}
            {/* Sidebar */}
            <div
                ref={sidebarRef}
                className={`${styles.sidebar} ${!isSidebarOpen ? styles.sidebarHidden : ""}`}>

                <button className={styles.closeSidebarBtn} onClick={() => setIsSidebarOpen(false)}>
                    ✕
                </button>

                <div className={styles.sidebarHeader}>
                    <h2>Hệ thống Đường Sắt</h2>
                </div>
                {/* Thanh điều hướng Tab */}
                <div className={styles.tabHeaders}>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'live' ? styles.tabActive : ""}`}
                        onClick={() => setActiveTab('live')}
                    >
                        📡 Trực tuyến
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabActive : ""}`}
                        onClick={() => setActiveTab('history')}
                    >
                        🕑 Lịch sử
                    </button>
                </div>
                <div className={styles.sidebarContent}>
                    {/* Danh sách tàu trực tuyến */}
                    {activeTab === 'live' && (
                        <div className={styles.sidebarSection}>
                            <h3 className={styles.sectionTitle}>📡 Đang hoạt động ({Object.keys(devices).length})</h3>
                            <div className={styles.deviceList}>
                                {Object.keys(devices).length > 0 ? (

                                    Object.keys(devices).map((id) => (
                                        <div
                                            key={id}
                                            className={styles.deviceItem}
                                            onClick={() => {
                                                setSelectedDevicePos([devices[id].lat, devices[id].lng]);
                                                setMapBounds(null); // Ưu tiên FlyTo vị trí tàu
                                            }}
                                        >
                                            <div className={styles.deviceName}>🚅 {id}</div>
                                            <div className={styles.deviceInfo}>
                                                <span>🚀Tốc độ: <b>{devices[id].speed}</b> km/h</span>
                                                <p><span>🔋Pin: {devices[id].battery}%</span> </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (<p className={styles.emptyText}>Không có tàu nào trực tuyến</p>

                                )}
                            </div>
                        </div>
                    )}

                    {/* Xem lại hành trình */}

                    {activeTab === 'history' && (
                        <div className={styles.sidebarSection}>
                            <h3 className={styles.sectionTitle}>
                                🚞 Danh sách chuyến đi</h3>
                            <div className={styles.filterContainer}>
                                {/*<label>Chọn ngày xem:</label>*/}
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className={styles.dateInput}
                                />
                            </div>

                            <div className={styles.sessionList}>
                                {sessions.length > 0 ? (
                                    sessions.map((s) => (
                                        <div
                                            key={s.session_id}
                                            className={`${styles.sessionItem} ${activeSessionPath ? styles.sessionActive : ""}`}
                                            onClick={() => handleViewHistory(s.session_id)}
                                        >
                                            <div className={styles.sessionMain}>
                                                <b>{s.ma_tau}</b>
                                                <span className={styles.sessionPoints}>{s.so_diem} điểm GPS</span>
                                            </div>
                                            {/* Hiển thị thời gian bắt đầu và kết thúc 
                                            <div className={styles.sessionTime}>
                                                🕒 {new Date(s.bat_dau * 1000).toLocaleTimeString()} - {new Date(s.ket_thuc * 1000).toLocaleTimeString()}
                                            </div>*/}
                                            <div className={styles.sessionTime}>
                                                🕒 {
                                                    isNaN(Number(s.bat_dau)) || Number(s.bat_dau) < 0 ? "Không rõ" :
                                                        new Date(Number(s.bat_dau) * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                                                }
                                                {" - "}
                                                {
                                                    isNaN(Number(s.ket_thuc)) || Number(s.ket_thuc) < 0 ? "Không rõ" :
                                                        new Date(Number(s.ket_thuc) * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                                                }
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className={styles.emptyText}> 🚫 Chưa có dữ liệu lịch sử</p>
                                )}
                            </div>
                            {activeSessionPath && (
                                <button onClick={() => setActiveSessionPath(null)} className={styles.clearBtn}>
                                    ✕ Đóng hành trình xem lại
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* khu vực bản đồ */}
            <div className={styles.mapWrapper}>
                <MapContainer
                    {...({
                        zoomControl: false,
                        center: [21.0285, 105.8542],
                        zoom: 15,
                        style: { height: "100%", width: "100%" },
                        gestureHandling: true,
                        scrollWheelZoom: true
                    } as any)}
                >
                    {/* nút điều khiển zoom */}
                    {/* Các vị trí "topleft", "topright", "bottomleft", "bottomright" */}
                    <ZoomControl position="bottomright" />

                    <LayersControl position="topright">
                        {/*   <LayersControl.BaseLayer checked name="Bản đồ đường bộ">
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        </LayersControl.BaseLayer> */}
                        <LayersControl.Overlay checked name="Bản đồ OSM">
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        </LayersControl.Overlay>
                        <LayersControl.Overlay name="Mạng lưới đường sắt (OpenRail)">
                            <TileLayer
                                url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
                                attribution='&copy; OpenRailwayMap'
                            />
                        </LayersControl.Overlay>

                        <LayersControl.Overlay checked name="GeoServer Railway Stations">
                            <WMSTileLayer
                                url={process.env.NEXT_PUBLIC_GEOSERVER_URL || " "}
                                layers="du_an_duong_sat:ga,du_an_duong_sat:duong_ray"
                                format="image/png"
                                transparent={true}
                                version="1.1.1"
                                zIndex={10}
                            />
                        </LayersControl.Overlay>

                        {/* Lớp hiển thị Lịch sử hành trình */}
                        <LayersControl.Overlay checked name="Hành trình xem lại">
                            <LayerGroup>
                                {activeSessionPath && (
                                    <>
                                        <Polyline
                                            positions={activeSessionPath}
                                            smoothFactor={1}
                                            pathOptions={{ color: "#ffae00", weight: 5, dashArray: '10, 10' }}
                                        />
                                        {/* 2. Điểm bắt đầu (Màu xanh) */}
                                        <Marker
                                            position={activeSessionPath[0]}
                                            icon={startIcon}
                                        >
                                            <Popup><b>Điểm bắt đầu</b><br />Hành trình của tàu</Popup>
                                        </Marker>

                                        {/* 3. Điểm kết thúc (Màu đỏ) */}
                                        <Marker
                                            position={activeSessionPath[activeSessionPath.length - 1]}
                                            icon={endIcon}
                                        >
                                            <Popup><b>Điểm kết thúc</b><br />Vị trí cuối cùng ghi nhận</Popup>
                                        </Marker>
                                    </>

                                )}
                            </LayerGroup>
                        </LayersControl.Overlay>

                        {/* Lớp hiển thị Tàu Realtime */}
                        <LayersControl.Overlay checked name="Vị trí tàu tức thời">
                            <LayerGroup>
                                {Object.keys(devices).map((id) => (
                                    <Marker
                                        key={id}
                                        position={[devices[id].lat, devices[id].lng]}
                                        icon={trainIcon}

                                        rotationAngle={devices[id].heading}
                                        rotationOrigin="center"
                                    >
                                        <Tooltip
                                            permanent
                                            direction="right"
                                            offset={[10, 0]}
                                            className={styles.trainLabel}
                                        >
                                            {id}
                                        </Tooltip>
                                        <Popup minWidth={320} eventHandlers={{
                                            remove: () => setSelectedWagon(null)
                                        }}>
                                            <div className={styles.popupContent}>
                                                <strong>📡 Tàu: {id}</strong>
                                                <hr />

                                                {/* Đồ họa đoàn tàu */}
                                                <div className={styles.trainComposition}>
                                                    <div className={`${styles.locomotive} ${!selectedWagon ? styles.locomotiveActive : ''}`}
                                                        onClick={() => setSelectedWagon(null)}>
                                                        {id}
                                                    </div>
                                                    {[...(devices[id].danh_sach_toa || [])].map((toa: any, idx: number) => (
                                                        <div
                                                            key={toa.ma_toa}
                                                            className={`${styles.wagon} ${toa.kieu_cho === 'Vip' ? styles.wagonVip : ''} ${selectedWagon?.ma_toa === toa.ma_toa ? styles.wagonActive : ''}`}
                                                            onClick={() => setSelectedWagon(toa)}
                                                        >
                                                            {idx + 1}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Chi tiết tàu */}
                                                {selectedWagon ? (
                                                    <div className={styles.wagonDetailBox}>
                                                        <b>Toa: {selectedWagon.ma_toa}</b> ({selectedWagon.loai_toa})
                                                        <div className={styles.wagonDetailGrid}>
                                                            <span>Kiểu: {selectedWagon.kieu_cho}</span>
                                                            <span>Tải: {selectedWagon.tai_trong}/{selectedWagon.suc_chua_toi_da}</span>
                                                        </div>
                                                        <div className={styles.loadBarBg}>
                                                            <div className={styles.loadBarFill} style={{ width: `${(selectedWagon.tai_trong / (selectedWagon.suc_chua_toi_da || 100)) * 100}%` }}></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className={styles.generalInfo}>
                                                        <p>🚀 Tốc độ: {devices[id].speed} km/h</p>
                                                        <p>📍 {devices[id].lat.toFixed(4)}, {devices[id].lng.toFixed(4)}</p>
                                                        <p>📦 Số toa: {devices[id].danh_sach_toa?.length || 0} </p>
                                                    </div>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </LayerGroup>
                        </LayersControl.Overlay>
                    </LayersControl>

                    <MapController center={selectedDevicePos} bounds={mapBounds} />
                </MapContainer>
            </div>
        </div>
    );
}










