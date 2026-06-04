import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import NextAuthProvider from "@/components/provider/NextAuthProvider";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GPS Tracking",
  description: "Real-time GPS tracking application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body
        className={`flex flex-col min-h-screen ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextAuthProvider>

          <Header />
          <main className="flex-grow pt-16 pb-10">
            {children}
            <ToastContainer
              position="top-right"
              autoClose={3000}
              theme="colored"
            />
          </main>
          <Footer />
        </NextAuthProvider>
      </body>
    </html>
  );
}
