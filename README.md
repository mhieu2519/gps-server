# 🚂 Railway GPS Tracking System

> Hệ thống giám sát và điều phối tàu hỏa theo thời gian thực sử dụng GPS, MQTT, WebSocket và bản đồ số.

**Đồ án tốt nghiệp** | Trường Điện – Điện tử | Sinh viên: Nguyễn Minh Hiếu

---

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng](#-tính-năng)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Hướng dẫn cài đặt](#-hướng-dẫn-cài-đặt)
- [Cấu hình biến môi trường](#-cấu-hình-biến-môi-trường)
- [Chạy dự án](#-chạy-dự-án)
- [Cấu trúc cơ sở dữ liệu](#-cấu-trúc-cơ-sở-dữ-liệu)
- [API Reference](#-api-reference)
- [Phân quyền người dùng](#-phân-quyền-người-dùng)
- [Luồng dữ liệu thời gian thực](#-luồng-dữ-liệu-thời-gian-thực)
- [Liên hệ](#-liên-hệ)

---

## 🎯 Giới thiệu

**Railway GPS Tracking System** là giải pháp giám sát hành trình đường sắt hiện đại, cho phép:

- Theo dõi **vị trí tàu theo thời gian thực** trên bản đồ số (Leaflet + GeoServer)
- Quản lý **lịch chạy tàu**, **lập đoàn tàu** và **phân phối lộ trình**
- Cập nhật **trạng thái toa xe** tại từng ga thông qua giao diện giám sát ga
- Hiển thị **tiến độ hành trình** bám theo đường ray (PostGIS + Socket.io)
- Xem lại **lịch sử hành trình** theo ngày

Dự án được xây dựng nhằm phục vụ nghiên cứu và ứng dụng thực tiễn trong vận hành đường sắt.

---

## ✨ Tính năng

### 🗺️ Bản đồ & Theo dõi thời gian thực
- Hiển thị vị trí tàu với icon tự xoay theo hướng di chuyển (leaflet-rotatedmarker)
- Animation mượt mà khi tàu di chuyển (Easing Quad interpolation)
- Tích hợp nhiều lớp bản đồ: Google Maps, OpenStreetMap, OpenRailwayMap
- Lớp GeoServer hiển thị hệ thống ga và đường ray từ PostGIS
- Thanh tiến độ hành trình bám sát vị trí tàu trên lộ trình

### 🚉 Giám sát tại ga (Supervisor)
- Phát hiện tàu trong bán kính **200m** quanh ga (Haversine formula)
- Cửa sổ cập nhật tự động mở/đóng khi tàu vào/rời ga (ân hạn 3 phút)
- Cập nhật số lượng hành khách, khối lượng hàng hóa, trạng thái toa
- Countdown timer hiển thị thời gian còn lại để cập nhật

### 📋 Quản lý điều phối (Admin)
- Tạo và quản lý **lịch chạy tàu** hàng ngày
- **Lập đoàn tàu**: gán đầu máy GPS, thiết lập danh sách toa
- Thiết kế **lộ trình** mới với danh sách ga theo thứ tự
- Móc nối **toa hàng hóa** từ kho vào đoàn tàu
- Bật/tắt trạng thái hoạt động từng toa

### 📈 Lịch sử & Báo cáo
- Xem lại hành trình tàu theo session (vẽ polyline trên bản đồ)
- Lọc lịch sử theo ngày
- Hiển thị điểm xuất phát và điểm kết thúc hành trình

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                      Thiết bị GPS (Tàu)                      │
│                    (Gửi MQTT → EMQX)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ MQTT (port 1883)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    EMQX Broker                               │
│           (Rule Engine → Save to PostgreSQL)                 │
│           (Rule Engine → Publish to Redis Pub/Sub)           │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│   PostgreSQL/PostGIS │   │         Redis Cache               │
│  (Lưu tọa độ, lịch  │   │   (Pub/Sub kênh train_locations) │
│   sử, cấu hình)     │   └──────────────┬───────────────────┘
└──────────────────────┘                  │
                                          ▼
                          ┌──────────────────────────────────┐
                          │       Socket Server (Node.js)     │
                          │  - Subscribe Redis channel        │
                          │  - PostGIS snap-to-rail query     │
                          │  - Emit train_update → clients    │
                          └──────────────┬───────────────────┘
                                         │ WebSocket (port 4000)
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js Web App (port 3000)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Map.tsx    │  │  Dispatch   │  │  Station Update      │ │
│  │  (Leaflet)  │  │  Admin      │  │  (Supervisor)        │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  GeoServer (port 8080) │
              │  (WMS: ga, đường ray)  │
              └────────────────────────┘
                          │
              ┌────────────────────────┐
              │  Cloudflare Tunnel     │
              │  (HTTPS ra Internet)   │
              └────────────────────────┘
```

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ | Phiên bản |
|-----------|-----------|-----------|
| **Frontend** | Next.js, TypeScript, React | 16.x / 19.x |
| **Bản đồ** | Leaflet, React-Leaflet | 1.9.x / 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Backend** | Next.js API Routes | – |
| **Socket Server** | Node.js, Socket.io, Express | 4.8.x |
| **Database** | PostgreSQL + PostGIS | 15 / 3.3 |
| **Cache / Pub-Sub** | Redis (redis-stack-server) | latest |
| **MQTT Broker** | EMQX | latest |
| **Bản đồ GIS** | GeoServer | latest |
| **Authentication** | NextAuth.js + bcrypt | 4.x |
| **Container** | Docker, Docker Compose | – |
| **Tunnel** | Cloudflare Tunnel | – |

---

## 📁 Cấu trúc thư mục

```
gps-server/
├── docker-compose.yml          # Orchestration toàn bộ services
├── gps-map/                    # Next.js Web Application
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/           # NextAuth + đăng ký tài khoản
│   │   │   ├── dispatch/       # API quản lý điều phối
│   │   │   │   ├── passenger/  # Dữ liệu toa khách
│   │   │   │   ├── routes/     # Quản lý lộ trình
│   │   │   │   ├── save-layout/# Lưu cấu hình lập tàu
│   │   │   │   ├── schedule/   # Lịch chạy tàu
│   │   │   │   └── stations/   # Danh mục ga
│   │   │   ├── station/
│   │   │   │   ├── active-trains/ # Tàu trong bán kính ga
│   │   │   │   └── report/        # Cập nhật bản tin tại ga
│   │   │   └── trains/
│   │   │       ├── history/    # Lịch sử hành trình
│   │   │       └── status/     # Trạng thái tàu hiện tại
│   │   ├── admin/
│   │   │   ├── dispatch/       # Trang điều phối (Admin)
│   │   │   │   └── schedule/   # Lịch chạy tàu
│   │   │   └── station/
│   │   │       └── update/     # Cập nhật tại ga (Supervisor)
│   │   └── page.tsx            # Trang chủ (bản đồ)
│   ├── components/
│   │   ├── Layout/             # Header, Footer, LoginModal
│   │   └── Map/
│   │       ├── Map.tsx         # Component bản đồ chính
│   │       ├── MapClient.tsx   # Dynamic import (no SSR)
│   │       ├── SmoothTrainMarker.tsx  # Marker animation
│   │       ├── TrainRouteProgress.tsx # Thanh tiến độ hành trình
│   │       └── types.ts        # TypeScript interfaces
│   ├── lib/
│   │   ├── db.ts               # PostgreSQL connection pool
│   │   └── auth-guard.ts       # Middleware kiểm tra quyền admin
│   └── proxy.ts                # Route protection middleware
│
└── socket-server/              # Socket.io Server (Node.js)
    ├── index.js                # Server chính
    ├── package.json
    └── Dockerfile
```

---

## 💻 Yêu cầu hệ thống

- **Docker** >= 24.x và **Docker Compose** >= 2.x
- **Node.js** >= 20.9.0 (nếu chạy local không dùng Docker)
- **RAM** tối thiểu: 4GB (khuyến nghị 8GB)
- Tài khoản **Cloudflare** (nếu muốn expose ra Internet)

---

## 🚀 Hướng dẫn cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd gps-server
```

### 2. Tạo file cấu hình môi trường

```bash
cp .env.example .env
```

Chỉnh sửa file `.env` theo hướng dẫn ở phần [Cấu hình biến môi trường](#-cấu-hình-biến-môi-trường).

### 3. Cài đặt dependencies (chạy local, không Docker)

```bash
# Web app
cd gps-map
npm install

# Socket server
cd ../socket-server
npm install
```

### 4. Khởi tạo cơ sở dữ liệu

Sau khi PostgreSQL chạy (qua Docker), kết nối và tạo các bảng cần thiết:

```sql
-- Kích hoạt PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tạo các bảng (xem phần Cấu trúc CSDL bên dưới)
```

### 5. Cấu hình EMQX

Truy cập EMQX Dashboard tại `http://localhost:18083` (admin/public):

1. **Rule Engine → Rules**: Tạo rule lắng nghe topic `gps/+/location`
2. **Action 1**: `Save_to_postgres_action` → lưu vào bảng `tau` (upsert theo `ma_tau`)
3. **Action 2**: `Publish_to_redis` → publish vào kênh `train_locations`

**Payload format từ thiết bị GPS:**
```json
{
  "ma_tau": "D19E-941",
  "latitude": 21.0285,
  "longitude": 105.8542,
  "speed": 85.5,
  "heading": 180,
  "battery": 92,
  "signal": 4
}
```

### 6. Cấu hình GeoServer

Truy cập `http://localhost:8080/geoserver`:

1. Tạo Workspace: `du_an_duong_sat`
2. Tạo Store: kết nối PostgreSQL/PostGIS
3. Publish 2 layers: `ga` (điểm ga) và `duong_ray` (đường ray)
4. Cấu hình SLD style cho từng layer

---

## ⚙️ Cấu hình biến môi trường

### File `.env` (root)

```env
# PostgreSQL
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_DB=railway_db

# Redis
REDIS_URL=redis://redis_cache:6379

# Cloudflare Tunnel
TUNNEL_TOKEN=your_cloudflare_tunnel_token

# Domain
DOMAIN=your-domain.com
```

### File `gps-map/.env.local`

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/railway_db

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your_super_secret_key_min_32_chars

# Admin tối cao (đăng nhập không qua DB)
ADMIN_USER=admin
ADMIN_PASS=your_admin_password

# Socket Server
NEXT_PUBLIC_SOCKET_URL=https://socket.your-domain.com

# GeoServer
NEXT_PUBLIC_GEOSERVER_URL=https://geo.your-domain.com/geoserver/wms
```

---

## ▶️ Chạy dự án

### Sử dụng Docker Compose (khuyến nghị)

```bash
# Khởi động toàn bộ hệ thống
docker-compose up -d

# Xem logs
docker-compose logs -f

# Dừng hệ thống
docker-compose down
```

**Services khởi động:**

| Service | Port | Mô tả |
|---------|------|-------|
| `map_db` | 5432 | PostgreSQL + PostGIS |
| `map_server` | 8080 | GeoServer |
| `emqx` | 1883, 8083, 18083 | MQTT Broker |
| `redis_cache` | 6379 | Redis |
| `socket-service` | 4000 | Socket.io Server |
| `gps-web` | 3000 | Next.js Web App |
| `tunnel` | – | Cloudflare Tunnel |

### Chạy local (development)

```bash
# Terminal 1: Web app
cd gps-map
npm run dev

# Terminal 2: Socket server
cd socket-server
node index.js
```

---

## 🗄️ Cấu trúc cơ sở dữ liệu

### Bảng chính

```sql
-- Đầu máy / thiết bị GPS
CREATE TABLE tau (
    ma_tau      VARCHAR PRIMARY KEY,
    lat         NUMERIC(10, 7),
    lng         NUMERIC(10, 7),
    speed       NUMERIC(6, 2),
    heading     NUMERIC(6, 2),
    battery     INTEGER,
    signal      INTEGER,
    timestamp   BIGINT
);

-- Ga tàu (có tọa độ PostGIS)
CREATE TABLE ga (
    ma_ga               VARCHAR PRIMARY KEY,
    ten_ga              VARCHAR,
    geom                GEOMETRY(GEOMETRY, 4326),
    detection_radius_m  INTEGER DEFAULT 200
);

-- Đường ray (PostGIS MultiLineString)
CREATE TABLE duong_ray (
    id          VARCHAR PRIMARY KEY,  -- Ví dụ: "HN-LB"
    ten_tuyen   VARCHAR,
    geom        GEOMETRY(MULTILINESTRING, 4326)
);

-- Lộ trình hành trình
CREATE TABLE lo_trinh (
    ma_lo_trinh     VARCHAR PRIMARY KEY,
    ten_lo_trinh    VARCHAR,
    danh_sach_ga    TEXT[]  -- Mảng mã ga theo thứ tự
);

-- Lịch chạy tàu
CREATE TABLE lich_chay_tau (
    ma_chuyen_di    VARCHAR PRIMARY KEY,  -- VD: "SE1_2026_06_08"
    ma_tau          VARCHAR,
    ngay_chay       DATE,
    ma_dau_may      VARCHAR,
    ma_lo_trinh     VARCHAR,
    trang_thai      VARCHAR DEFAULT 'CHO_LAP_TAU'
);

-- Chuyến đi vận hành
CREATE TABLE chuyen_di (
    ma_chuyen_di    VARCHAR PRIMARY KEY,
    ngay_chay       DATE,
    ma_tau_chay     VARCHAR,
    ma_lo_trinh     VARCHAR,
    trang_thai      VARCHAR  -- 'san_sang', 'dang_chay', 'ket_thuc'
);

-- Chi tiết lập tàu (toa xe trong chuyến đi)
CREATE TABLE chi_tiet_lap_tau (
    id                  SERIAL PRIMARY KEY,
    ma_chuyen_di        VARCHAR,
    ma_toa              VARCHAR,
    thu_tu_toa          INTEGER,
    is_active           BOOLEAN DEFAULT true,
    so_luong_thuc_te    INTEGER DEFAULT 0
);

-- Toa xe
CREATE TABLE toa (
    ma_toa          VARCHAR PRIMARY KEY,
    loai_toa        VARCHAR,  -- 'KH_NGOI', 'KH_NAM', 'HANG_HOA'
    kieu_cho        VARCHAR,
    suc_chua_toi_da INTEGER,
    tai_trong       NUMERIC
);

-- Dữ liệu đặt vé (toa khách)
CREATE TABLE du_lieu_dat_ve (
    id                  SERIAL PRIMARY KEY,
    ma_chuyen_di        VARCHAR,
    ma_toa              VARCHAR,
    loai_toa            VARCHAR,
    so_luong_thuc_te    INTEGER,
    suc_chua_toi_da     INTEGER,
    is_processed        BOOLEAN DEFAULT false
);

-- Dữ liệu toa hàng
CREATE TABLE du_lieu_tau_hang (
    id                      SERIAL PRIMARY KEY,
    ma_toa                  VARCHAR,
    loai_toa                VARCHAR DEFAULT 'HANG_HOA',
    ten_hang_hoa            VARCHAR,
    khoi_luong_thuc_te      NUMERIC,
    khoi_luong_toida        NUMERIC,
    don_vi                  VARCHAR DEFAULT 'tấn',
    trang_thai              VARCHAR,
    is_processed            BOOLEAN DEFAULT false,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Lịch sử tọa độ
CREATE TABLE lich_su_tau (
    id          SERIAL PRIMARY KEY,
    ma_tau      VARCHAR,
    session_id  VARCHAR,
    geom        GEOMETRY(POINT, 4326),
    timestamp   BIGINT
);

-- Tài khoản người dùng
CREATE TABLE tai_khoan (
    id              SERIAL PRIMARY KEY,
    ten_dang_nhap   VARCHAR UNIQUE,
    mat_khau        VARCHAR,  -- bcrypt hash
    vai_tro         VARCHAR,  -- 'admin', 'supervisor', 'user'
    ma_ga           VARCHAR,  -- NULL = không gắn ga
    "lastTime"      TIMESTAMPTZ
);

-- Log cập nhật tại ga
CREATE TABLE station_update_log (
    id                  SERIAL PRIMARY KEY,
    ma_ga               VARCHAR,
    ma_chuyen_di        VARCHAR,
    ma_toa              VARCHAR,
    loai_toa            VARCHAR,
    so_luong_thuc_te    INTEGER,
    khoi_luong_thuc_te  NUMERIC(10, 2),
    trang_thai_toa      VARCHAR DEFAULT 'binh_thuong',
    ghi_chu             TEXT,
    ten_dang_nhap       VARCHAR,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Trạng thái cửa sổ cập nhật ga
CREATE TABLE station_window_state (
    ma_ga           VARCHAR PRIMARY KEY,
    last_train_in   TIMESTAMPTZ,
    window_closes   TIMESTAMPTZ
);
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Mô tả | Quyền |
|--------|----------|-------|-------|
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | Public |
| `POST` | `/api/auth/[...nextauth]` | Đăng nhập (NextAuth) | Public |

### Trains

| Method | Endpoint | Mô tả | Quyền |
|--------|----------|-------|-------|
| `GET` | `/api/trains/status` | Trạng thái tất cả tàu đang chạy | Public |
| `GET` | `/api/trains/history` | Lịch sử hành trình | Public |
| `GET` | `/api/trains/history?session_id=xxx` | Tọa độ chi tiết 1 session | Public |
| `GET` | `/api/trains/history?date=YYYY-MM-DD` | Lịch sử theo ngày | Public |

### Dispatch (Admin only)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/dispatch/schedule/trips` | Danh sách chuyến đi |
| `POST` | `/api/dispatch/schedule/create` | Tạo lịch chạy tàu mới |
| `DELETE` | `/api/dispatch/schedule/delete` | Xóa chuyến đi |
| `GET` | `/api/dispatch/routes` | Danh mục lộ trình |
| `POST` | `/api/dispatch/create` | Tạo/cập nhật lộ trình |
| `GET` | `/api/dispatch/stations` | Danh mục ga |
| `GET` | `/api/dispatch/passenger?trip=xxx` | Dữ liệu toa khách theo chuyến |
| `GET` | `/api/dispatch/available-cargo` | Toa hàng chưa phân phối |
| `POST` | `/api/dispatch/save-layout` | Lưu cấu hình lập tàu |

**Body `/api/dispatch/save-layout`:**
```json
{
  "selectedTrip": "SE1_2026_06_08",
  "trainHead": "D19E-941",
  "ma_lo_trinh": "LT_HN_HP",
  "layout": [
    {
      "ma_toa": "SE1-01",
      "loai_toa": "KH_NGOI",
      "is_active": true,
      "so_luong_thuc_te": 64
    }
  ]
}
```

### Station (Admin / Supervisor)

| Method | Endpoint | Mô tả | Quyền |
|--------|----------|-------|-------|
| `GET` | `/api/station/active-trains` | Tàu trong bán kính ga | Admin / Supervisor |
| `POST` | `/api/station/report` | Gửi bản tin cập nhật tại ga | Admin / Supervisor |

**Body `/api/station/report`:**
```json
{
  "ma_chuyen_di": "SE1_2026_06_08",
  "ma_tau": "D19E-941",
  "carriages": [
    {
      "ma_toa": "SE1-01",
      "loai_toa": "KH_NGOI",
      "so_luong_thuc_te": 58,
      "trang_thai_toa": "binh_thuong",
      "ghi_chu": ""
    }
  ]
}
```

---

## 👥 Phân quyền người dùng

| Role | Quyền truy cập |
|------|---------------|
| **`admin`** | Toàn quyền: điều phối tàu, lịch chạy, xem tất cả ga, cập nhật tại bất kỳ ga nào |
| **`supervisor`** | Chỉ xem và cập nhật tàu trong bán kính ga được gán (`ma_ga` trong `tai_khoan`) |
| **`user`** | Xem bản đồ, xem lịch sử hành trình |

**Tạo tài khoản Supervisor:**
```sql
-- Tạo tài khoản và gán ga "Ga Hải Phòng" (ma_ga = HP)
UPDATE tai_khoan
SET vai_tro = 'supervisor', ma_ga = 'HP'
WHERE ten_dang_nhap = 'supervisor_hp';
```

---

## 🔄 Luồng dữ liệu thời gian thực

```
Thiết bị GPS
    │
    │ MQTT publish → topic: gps/{ma_tau}/location
    ▼
EMQX Broker
    ├─→ Rule 1: Upsert vào bảng `tau` (PostgreSQL)
    └─→ Rule 2: Publish vào Redis channel `train_locations`
                            │
                            ▼
                    Socket Server (Node.js)
                    ├─ Subscribe Redis channel
                    ├─ Lọc tàu có chuyến `dang_chay`
                    ├─ PostGIS snap-to-rail:
                    │   ST_LineLocatePoint → tính tiến độ
                    │   ST_Azimuth → xác định chiều di chuyển
                    │   Tính ETA, khoảng cách còn lại
                    └─ io.emit('train_update', enrichedData)
                                    │
                                    ▼
                        Web Client (Map.tsx)
                        ├─ Cập nhật vị trí marker (animation)
                        └─ Cập nhật TrainRouteProgress component
```

**Cấu trúc `socketData` từ Socket Server:**
```json
{
  "ma_tau": "D19E-941",
  "lat": 21.0285,
  "lng": 105.8542,
  "speed": 85.5,
  "heading": 180,
  "socketData": {
    "current_segment": "HN-HP",
    "next_station_code": "HP",
    "segment_progress": 0.73,
    "distance_left_meters": 12500,
    "eta_minutes": 8.7,
    "is_at_station": false
  }
}
```

---

## 📞 Liên hệ

**Sinh viên thực hiện:** Nguyễn Minh Hiếu

| Kênh | Thông tin |
|------|-----------|
| 📧 Email | support@gps-map.online |
| 📱 SĐT | 0375 *** *** |
| 🏫 Đơn vị | Trường Điện – Điện tử |

---

<div align="center">

© 2026 Railway GPS Tracking System — Đồ án tốt nghiệp Trường Điện – Điện tử

</div>