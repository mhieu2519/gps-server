import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Admin Login",
            credentials: {
                username: { label: "Tài khoản", type: "text" },
                password: { label: "Mật khẩu", type: "password" }
            },
            async authorize(credentials) {
                // Đây là nơi bạn kiểm tra với Database hoặc biến môi trường
                if (credentials.username === process.env.ADMIN_USER &&
                    credentials.password === process.env.ADMIN_PASS) {
                    return { id: "1", name: "Admin", email: "admin@example.com" };
                }
                return null; // Đăng nhập thất bại
            }
        })
    ],
    pages: {
        signIn: '/auth/login', // Trang đăng nhập tự chế của bạn
    }
});

export { handler as GET, handler as POST };