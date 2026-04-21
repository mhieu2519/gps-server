export default function ServicesPage() {
    return (
        <div className="py-20 px-6 max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold text-cyan-800 mb-12 text-center">Dịch vụ của chúng tôi</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 border rounded-xl shadow-sm bg-white">
                    <h3 className="font-bold text-xl mb-3">Theo dõi Real-time</h3>
                    <p className="text-gray-600">Cập nhật vị trí tàu hỏa liên tục trên bản đồ số.</p>
                </div>
                <div className="p-6 border rounded-xl shadow-sm bg-white">
                    <h3 className="font-bold text-xl mb-3">Báo cáo hành trình</h3>
                    <p className="text-gray-600">Lưu trữ và truy xuất lịch sử di chuyển.</p>
                </div>
                <div className="p-6 border rounded-xl shadow-sm bg-white">
                    <h3 className="font-bold text-xl mb-3">Cảnh báo tốc độ</h3>
                    <p className="text-gray-600">Hệ thống tự động thông báo khi tàu vượt quá tốc độ cho phép.</p>
                </div>
            </div>
        </div>
    );
}