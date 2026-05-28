import { AiOutlineLoading } from "react-icons/ai";
export default function DashboardPage() {
    return (
        <div className="p-6 text-white">
            <h1 className="text-3xl font-bold mb-4">
                Dashboard
            </h1>

            <div className="flex items-center gap-2 text-white">
                <AiOutlineLoading className="animate-spin text-xl" />
                <span>Trang đang chờ được phát triển...</span>
            </div>
        </div>
    );
}