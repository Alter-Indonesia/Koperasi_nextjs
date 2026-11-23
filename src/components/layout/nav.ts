import {
  BadgeCheck, Bell, CalendarClock, CalendarDays, CalendarRange, ClipboardCheck, ClipboardList, Database, FileBarChart, HandCoins, History, Receipt, LayoutDashboard, Map, MapPin,
  ScrollText, ShieldCheck, SlidersHorizontal, UserCog, UserRound, Users, Wallet, type LucideIcon,
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
 * (mis. MENU ADMIN). Item disaring lagi menurut hak akses role (matriks di menu Sistem › Role).
 */
/** Menu Sistem: tampil di menu profil pengguna (klik kartu profil di bawah sidebar), disaring menurut hak akses. */
export const SYSTEM_MENU: NavDef[] = [
  { href: "/admin/sistem/pengguna", label: "Pengguna", icon: UserCog, module: "users" },
  { href: "/admin/sistem/role", label: "Role", icon: ShieldCheck, module: "roles" },
  { href: "/admin/sistem/log-aktivitas", label: "Log Aktivitas", icon: ScrollText, module: "activity_logs" },
  { href: "/admin/sistem/pengaturan", label: "Pengaturan", icon: SlidersHorizontal, module: "settings" },
];

const ADMIN_NAV: NavGroupDef[] = [
    {
      label: "MENU ADMIN",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard, module: "dashboard", exact: true },
        { href: "/admin/anggota", label: "Data Anggota", icon: Users, module: "members" },
        { href: "/admin/pinjaman", label: "Data Pinjaman", icon: Wallet, module: "loans" },
        { href: "/admin/jatuh-tempo", label: "Jatuh Tempo", icon: CalendarClock, module: "due_dates" },
        { href: "/admin/verifikasi", label: "Verifikasi Bayar", icon: BadgeCheck, module: "payments", badge: "payments" },
        { href: "/admin/pelunasan", label: "Pelunasan", icon: Receipt, module: "payments" },
        { href: "/admin/setoran", label: "Setoran Petugas", icon: HandCoins, module: "deposit_receipts" },
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
      ],
    },
];

/** Owner (superadmin): menu Owner di atas, lalu semua menu Admin (Dashboard & Laporan Admin tidak diulang). */
const OWNER_NAV: NavGroupDef[] = [
    {
      label: "", // tanpa label: menu Owner langsung di atas, lalu MENU ADMIN
      items: [
        { href: "/owner", label: "Dashboard", icon: LayoutDashboard, module: "dashboard", exact: true },
        { href: "/owner/persetujuan", label: "Persetujuan Pinjaman", icon: ClipboardCheck, module: "loan_approvals" },
        { href: "/owner/laporan", label: "Laporan Penagihan", icon: FileBarChart, module: "reports" },
      ],
    },
    ...ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== "/admin" && i.href !== "/admin/laporan") })),
];

export const NAV: Record<Area, NavGroupDef[]> = {
  admin: ADMIN_NAV,
  owner: OWNER_NAV,
  petugas: [
    {
      label: "MENU PETUGAS",
      items: [
        { href: "/petugas", label: "Tugas", icon: ClipboardList, module: "my_tasks", exact: true },
        { href: "/petugas/pelunasan", label: "Pelunasan", icon: Receipt, module: "my_tasks" },
        { href: "/petugas/riwayat", label: "Setoran", icon: History, module: "my_deposits" },
        { href: "/petugas/profil", label: "Profil", icon: UserRound, module: "my_tasks" },
      ],
    },
  ],
  anggota: [
    {
      label: "MENU ANGGOTA",
      items: [
        { href: "/anggota", label: "Beranda", icon: LayoutDashboard, module: "my_loans", exact: true },
        { href: "/anggota/pinjaman", label: "Pinjaman", icon: Wallet, module: "my_loans" },
        { href: "/anggota/jadwal", label: "Jadwal", icon: CalendarDays, module: "my_loans" },
        { href: "/anggota/profil", label: "Profil", icon: UserRound, module: "my_loans" },
      ],
    },
  ],
};
