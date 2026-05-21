// lib/db.ts
import { Pool } from 'pg';

// Tận dụng lại DATABASE_URL 
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Giới hạn 10 kết nối đồng thời để tối ưu hiệu năng
});

export const db = {
    // Hàm query 
    query: async (text: string, params?: any[]) => {
        const client = await pool.connect();
        try {
            return await client.query(text, params);
        } finally {
            client.release(); // Luôn tự động giải phóng kết nối sau khi chạy xong
        }
    }
};