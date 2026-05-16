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

                if (credentials.username === process.env.ADMIN_USER &&
                    credentials.password === process.env.ADMIN_PASS) {
                    return { id: "1", name: "Admin", email: "admin@example.com" };
                }
                return null;
            }
        })
    ],
    pages: {
        signIn: '/auth/login',
    }
});

export { handler as GET, handler as POST };