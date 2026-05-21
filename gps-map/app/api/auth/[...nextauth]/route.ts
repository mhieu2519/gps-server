// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { db } from "@/lib/db";

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Tài khoản", type: "text" },
                password: { label: "Mật khẩu", type: "password" }
            },
            async authorize(credentials) {
                // Nếu không nhập đủ thông tin, từ chối đăng nhập ngay
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                const { username, password } = credentials;

                // CƠ CHẾ 1: Kiểm tra quyền ADMIN tối cao từ file .env trước
                if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
                    return {
                        id: "admin-id",
                        name: "Hệ thống Admin",
                        role: "admin"
                    };
                }

                try {
                    // CƠ CHẾ 2: Kiểm tra tài khoản USER thông thường trong Database Postgres
                    const queryText = "SELECT * FROM accounts WHERE user = $1 LIMIT 1";
                    const result = await db.query(queryText, [username]);

                    // Nếu tìm thấy tài khoản trong DB
                    if (result.rows.length > 0) {
                        const account = result.rows[0];

                        // So sánh mật khẩu người dùng nhập với mật khẩu đã băm (bcrypt) trong DB
                        const isPasswordMatch = await bcrypt.compare(password, account.passwd);

                        if (isPasswordMatch) {
                            // Trả về đối tượng user hợp lệ để NextAuth tạo Session/Cookie
                            return {
                                id: account.id ? String(account.id) : username,
                                name: account.user,
                                role: account.role || "user"
                            };
                        }
                    }
                } catch (error) {
                    console.error("❌ Lỗi xử lý cơ sở dữ liệu khi đăng nhập:", error);
                }

                // Đăng nhập thất bại (Sai tài khoản hoặc sai mật khẩu)
                return null;
            }
        })
    ],
    // Lưu thông tin vai trò (role) vào JWT và Session để Client (Giao diện) kiểm tra quyền truy cập
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
            }
            return session;
        }
    },
    pages: {
        signIn: '/auth/login', // Trang giao diện đăng nhập tùy chỉnh của bạn
    },
    secret: process.env.NEXTAUTH_SECRET, // Đảm bảo đã khai báo khóa bảo mật này trong .env
    session: {
        strategy: "jwt", // Sử dụng mã hóa JWT Token lưu ở Cookie trình duyệt
    }
});

export { handler as GET, handler as POST };