import MapClient from "../components/Map/MapClient";

export default function Home() {
  return (
    <div className="flex flex-col ">
      {/* Khu vực Bản đồ */}
      <section id="map" className="w-full h-[80vh] relative z-10">
        <MapClient />
      </section>

      {/* Quy trình */}

      <section className="mt-40 py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16">Quy trình vận hành hệ thống</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">1</div>
              <h3 className="font-bold text-xl mb-4">Thu nhận tín hiệu</h3>
              <p className="text-gray-600">Thiết bị GPS trên đầu máy tàu hỏa thu nhận tọa độ từ vệ tinh và gửi về máy chủ.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">2</div>
              <h3 className="font-bold text-xl mb-4">Xử lý dữ liệu</h3>
              <p className="text-gray-600">Server Node.js xử lý dữ liệu và lưu trữ vào cơ sở dữ liệu không gian PostGIS.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">3</div>
              <h3 className="font-bold text-xl mb-4">Hiển thị trực quan</h3>
              <p className="text-gray-600">Dữ liệu được truyền tải qua API và hiển thị thời gian thực trên bản đồ Leaflet.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System overview */}

      <section className="bg-cyan-900 py-16 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-10 text-center text-cyan-200 uppercase tracking-widest">
            Trạng thái hệ thống
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Thẻ 1 */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl hover:bg-white/20 transition-all duration-300 group">
              <div className="text-4xl font-black mb-2 text-cyan-400 group-hover:scale-110 transition-transform">24/7</div>
              <div className="text-cyan-100 text-xs font-semibold uppercase tracking-wider">Giám sát liên tục</div>
            </div>

            {/* Thẻ 2 */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl hover:bg-white/20 transition-all duration-300 group">
              <div className="text-4xl font-black mb-2 text-cyan-400 group-hover:scale-110 transition-transform">150+</div>
              <div className="text-cyan-100 text-xs font-semibold uppercase tracking-wider">Điểm giám sát</div>
            </div>

            {/* Thẻ 3 */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl hover:bg-white/20 transition-all duration-300 group">
              <div className="text-4xl font-black mb-2 text-cyan-400 group-hover:scale-110 transition-transform">&lt; 1s</div>
              <div className="text-cyan-100 text-xs font-semibold uppercase tracking-wider">Độ trễ dữ liệu</div>
            </div>

            {/* Thẻ 4 */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl hover:bg-white/20 transition-all duration-300 group">
              <div className="text-4xl font-black mb-2 text-cyan-400 group-hover:scale-110 transition-transform">99.9%</div>
              <div className="text-cyan-100 text-xs font-semibold uppercase tracking-wider">Độ chính xác GPS</div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}