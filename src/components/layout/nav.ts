import {
  BadgeCheck, Bell, CalendarClock, CalendarDays, CalendarRange, ClipboardCheck, ClipboardList, Database, FileBarChart, History, LayoutDashboard, Map, MapPin,
  ScrollText, Settings, ShieldCheck, UserCog, UserRound, Users, Wallet, type LucideIcon,
} from "lucide-react";
import type { Action, Area, Module } from "@/lib/permissions";

export type NavDef = {
  href: string;
  label: string;
  icon: LucideIcon;
  module?: Module; // tampil hanya bila role punya hak (default: lihat); tanpa module = selalu tampil
  action?: Action;
  exact?: boolean;
  badge?: "payments";
  children?: NavDef[]; // sub menu: item ini menjadi induk yang bisa dibuka-tutup (tanpa href halaman sendiri)
};
export type NavGroupDef = { label: string; items: NavDef[] };

/**
 * Menu per area. Tiap role hanya melihat menu areanya sendiri; di dalamnya ada label pembatas
 * (mis. MENU ADMIN · MASTER DATA · SISTEM). Item disaring lagi menurut hak akses role (matriks di menu Sistem › Role).
 */
export const NAV: Record<Area, NavGroupDef[]> = {
  admin: [
    {
      label: "MENU ADMIN",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard, module: "dashboard", exact: true },
        { href: "/admin/anggota", label: "Data Anggota", icon: Users, module: "members" },
        { href: "/admin/pinjaman", label: "Data Pinjaman", icon: Wallet, module: "loans" },
        { href: "/admin/jatuh-tempo", label: "Jatuh Tempo", icon: CalendarClock, module: "due_dates" },
        { href: "/admin/verifikasi", label: "Verifikasi Bayar", icon: BadgeCheck, module: "payments", badge: "payments" },
        { href: "/admin/penugasan", label: "Penugasan Petugas", icon: MapPin, module: "assignments" },
        { href: "/admin/pengingat", label: "Pengingat Tagihan", icon: Bell, module: "reminders" },
        { href: "/admin/laporan", label: "Laporan Penagihan", icon: FileBarChart, module: "reports" },
        {
          href: "/admin/master", label: "Master Data", icon: Database,
          children: [
            { href: "/admin/master/wilayah", label: "Wilayah", icon: Map, module: "regions" },
            { href: "/admin/master/tenor", label: "Tenor", icon: CalendarRange, module: "tenors" },
          ],
        },
        {
          href: "/admin/sistem", label: "Sistem", icon: Settings,
          children: [
            { href: "/admin/sistem/pengguna", label: "Pengguna", icon: UserCog, module: "users" },
            { href: "/admin/sistem/role", label: "Role", icon: ShieldCheck, module: "roles" },
            { href: "/admin/sistem/log-aktivitas", label: "Log Aktivitas", icon: ScrollText, module: "activity_logs" },
          ],
        },
      ],
    },
  ],
  owner: [
    {
      label: "MENU OWNER",
      items: [
        { href: "/owner", label: "Dashboard", icon: LayoutDashboard, module: "dashboard", exact: true },
        { href: "/owner/persetujuan", label: "Persetujuan Pinjaman", icon: ClipboardCheck, module: "loan_approvals" },
        { href: "/owner/laporan", label: "Laporan Penagihan", icon: FileBarChart, module: "reports" },
      ],
    },
  ],
  petugas: [
    {
      label: "MENU PETUGAS",
      items: [
        { href: "/petugas", label: "Tugas Hari Ini", icon: ClipboardList, exact: true },
        { href: "/petugas/riwayat", label: "Riwayat Setoran", icon: History },
        { href: "/petugas/profil", label: "Profil", icon: UserRound },
      ],
    },
  ],
  anggota: [
    {
      label: "MENU ANGGOTA",
      items: [
        { href: "/anggota", label: "Beranda", icon: LayoutDashboard, exact: true },
        { href: "/anggota/pinjaman", label: "Pinjaman Saya", icon: Wallet },
        { href: "/anggota/jadwal", label: "Jadwal Angsuran", icon: CalendarDays },
        { href: "/anggota/profil", label: "Profil", icon: UserRound },
      ],
    },
  ],
};
