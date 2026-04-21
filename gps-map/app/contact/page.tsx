// src/app/contact/page.tsx

export default function ContactPage() {
    return (
        <main className="py-20 px-6 bg-gray-50 min-h-[70vh] flex items-center">
            <div className="max-w-4xl mx-auto w-full">
                <h1 className="text-4xl font-bold text-cyan-800 mb-10 text-center">
                    Thông tin liên hệ
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Cột 1: Thông tin cá nhân */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border">
                        <h2 className="text-xl font-bold text-cyan-800 mb-4 border-b pb-2">
                            Sinh viên thực hiện
                        </h2>
                        <p className="mb-3 text-lg">
                            <strong>Họ và tên:</strong> Nguyễn Minh Hiếu
                        </p>
                        <p className="mb-3 text-lg">
                            <strong>Mã sinh viên:</strong> 20******
                        </p>
                        <p className="text-lg">
                            <strong>Đơn vị:</strong> Trường Điện - Điện tử
                        </p>
                    </div>

                    {/* Cột 2: Kênh hỗ trợ */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border">
                        <h2 className="text-xl font-bold text-cyan-800 mb-4 border-b pb-2">
                            Kênh hỗ trợ
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="text-cyan-600 font-bold">SĐT:</span>
                                <span className="text-gray-700">0375 *** ***</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-cyan-600 font-bold">Email:</span>
                                <span className="text-gray-700 underline">support@gps-map.online</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-4 italic">
                                * Mọi thắc mắc về kỹ thuật hệ thống GPS Railway vui lòng gửi email để được hỗ trợ giải đáp nhanh nhất.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}