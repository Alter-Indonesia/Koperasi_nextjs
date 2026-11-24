import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaRegister } from "@/components/layout/PwaRegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "KoperasiKu",
  description: "Aplikasi simpan pinjam & penagihan koperasi",
  applicationName: "KoperasiKu",
  appleWebApp: { capable: true, title: "KoperasiKu", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0A0A0A" }; // bg-inverse tema Default

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
