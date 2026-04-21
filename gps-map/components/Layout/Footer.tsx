// components/layout/Footer.tsx
export default function Footer() {
    return (
        <footer className="w-full bg-[#1a222f] text-white border-t border-gray-700">
            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Sử dụng Grid với căn giữa theo chiều dọc items-center */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-center">

                    <div className="text-center md:text-left">
                        <h3 className="text-xl font-bold tracking-tight">
                            Railway Tracking System
                        </h3>
                        <p className="text-gray-500 text-xs mt-2 uppercase tracking-widest">
                            Trường Điện - Điện tử
                        </p>
                    </div>

                    <div className="text-center">
                        <p className="text-gray-400 text-sm">
                            © 2026 Bản quyền thuộc về <br className="hidden md:block" />
                            <span className="font-medium text-gray-300">....</span>
                        </p>
                    </div>

                    <div className="flex justify-center md:justify-end">
                        <div className="text-center">
                            <ul className="space-y-2">
                                <li> <a href="/about" className="text-gray-400 hover:text-cyan-400 text-sm transition-colors block">Về chúng tôi </a></li>
                                <li> <a href="/contact" className="text-gray-400 hover:text-cyan-400 text-sm transition-colors block"> Hỗ trợ </a> </li>
                            </ul>
                        </div>
                    </div>
                </div>


            </div>
        </footer>
    );
}