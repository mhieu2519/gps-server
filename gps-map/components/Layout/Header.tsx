// components/layout/Header.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
    const { data: session, status } = useSession();

    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <Link href="/"> GPS-Tracking</Link>
            </div>

            <nav className={styles.nav}>
                {status === "authenticated" ? (
                    <div className={styles.adminActions}>
                        <span className={styles.welcome}>Chào, <b>{session.user?.name}</b></span>
                        <Link href="/admin" className={styles.adminBtn}>Dashboard</Link>
                        <button onClick={() => signOut()} className={styles.logoutBtn}>
                            Đăng xuất
                        </button>
                    </div>
                ) : (
                    <button onClick={() => signIn()} className={styles.loginBtn}>
                        Đăng nhập Admin
                    </button>
                )}
            </nav>
        </header>
    );
}