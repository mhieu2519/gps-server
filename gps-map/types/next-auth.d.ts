// D:\vscode2\GPS\gps-server\gps-map\types\next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            name?: string | null;
            email?: string | null;
            role?: string | null; // Cấu hình role động từ bảng accounts trong DBeaver
        };
    }

    interface User {
        role?: string | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string | null;
    }
}