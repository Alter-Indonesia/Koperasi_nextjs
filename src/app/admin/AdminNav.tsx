"use client";
import { BadgeCheck, Bell, CalendarClock, FileBarChart, LayoutDashboard, MapPin, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PEMBAYARAN_BERUBAH, useApi } from "@/lib/api";
import { ROLE_LABEL, SessionProvider, useSession } from "@/lib/session";

type Jumlah = { jumlah: { menunggu: number } };
const BOLEH = ["admin", "owner"];

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const router = useRouter();
  const boleh = !!user && BOLEH.includes(user.role);
  // role lain (petugas/anggota) tidak memakai panel Admin
  useEffect(() => {
    if (user && !boleh) router.replace("/beranda");
  }, [user, boleh, router]);
  const { meta, reload } = useApi<unknown, Jumlah>(boleh ? "/api/v1/pembayaran?limit=1" : null);
  // halaman lain memicu event ini setelah verifikasi agar badge ikut diperbarui
  useEffect(() => {
    window.addEventListener(PEMBAYARAN_BERUBAH, reload);
    return () => window.removeEventListener(PEMBAYARAN_BERUBAH, reload);
  }, [reload]);
  const items = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/pinjaman", label: "Data Pinjaman", icon: Wallet },
    { href: "/admin/anggota", label: "Data Anggota", icon: Users },
    { href: "/admin/jatuh-tempo", label: "Jatuh Tempo", icon: CalendarClock },
    { href: "/admin/verifikasi", label: "Verifikasi Bayar", icon: BadgeCheck, badge: meta?.jumlah.menunggu },
    { href: "/admin/penugasan", label: "Penugasan Petugas", icon: MapPin },
    { href: "/admin/pengingat", label: "Pengingat Tagihan", icon: Bell },
    { href: "/admin/laporan", label: "Laporan Penagihan", icon: FileBarChart },
  ];
  return (
    <AppShell menuLabel="MENU ADMIN" items={items} user={user ? { name: user.nama, role: ROLE_LABEL[user.role] } : null} onLogout={logout}>
      {boleh ? children : null}
    </AppShell>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
