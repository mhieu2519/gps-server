import { AiOutlineLoading } from "react-icons/ai";
import { db } from "@/lib/db";

export default function ProfilePage() {
    return (
        <div className="p-6 text-white">
            <h1 className="text-2xl font-bold">
                Profile Page
            </h1>
            <p>Thông tin cá nhân và cài đặt của người dùng sẽ được hiển thị ở đây.</p>
            <p>Chức năng này đang được phát triển...</p>
            <div className="flex items-center gap-2 text-white mt-4">
                <AiOutlineLoading className="animate-spin text-xl" />
                <span>Đang tải...</span>
            </div>


        </div>
    );
}