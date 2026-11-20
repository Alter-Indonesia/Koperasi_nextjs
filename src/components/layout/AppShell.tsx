"use client";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { BottomNav } from "./BottomNav";
import { Sidebar, type NavGroup, type NavItem } from "./Sidebar";

/**
 * Pola layout: sidebar 240 tetap di kiri (lg ≥ 1024), konten dengan padding 32 dan jarak antar kartu 24.
 * Di bawah lg (tablet/HP) sidebar menjadi laci yang dibuka dari bilah atas (tombol menu); tertutup otomatis saat pindah halaman.
 * `responsive` (area Petugas): di bawah lg sidebar diganti navigasi bawah (tanpa bilah atas) dan konten dibatasi lebarnya.
 * Lebar konten: HP penuh · sm/md dipusatkan (Petugas 640/960) · xl 1200 · 2xl 1360 (Admin/Owner: penuh sampai 1560).
 */
export function AppShell({
  groups,
  profileMenu,
  user,
  onLogout,
  responsive,
  children,
}: {
  groups: NavGroup[];
  profileMenu?: NavItem[];
  user: { name: string; role: string; email?: string } | null;
  onLogout: () => void;
  responsive?: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null); // laci terbuka hanya di halaman tempat ia dibuka → pindah halaman menutupnya
  const open = openAt === path;
  return (
    <div className="min-h-screen bg-canvas">
      {!responsive && (
        <>
          <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-3 bg-inverse px-4 lg:hidden">
            <button type="button" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpenAt(path)} className="flex size-10 cursor-pointer items-center justify-center rounded-ctl text-fg-inverse hover:bg-inverse-raised">
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <span className="flex size-8 items-center justify-center rounded-chip bg-accent text-body font-bold text-on-accent">K</span>
            <span className="text-body font-bold text-fg-inverse">KoperasiKu</span>
          </header>
          {open && <div className="fixed inset-0 z-[25] bg-black/50 lg:hidden" onClick={() => setOpenAt(null)} aria-hidden />}
        </>
      )}
      <Sidebar
        groups={groups}
        profileMenu={profileMenu}
        user={user}
        onLogout={onLogout}
        className={responsive ? "max-lg:hidden" : cx("max-w-[85vw] max-lg:transition-transform", !open && "max-lg:-translate-x-full")}
      />
      {responsive ? (
        <>
          <main className="min-w-0 overflow-x-clip px-4 pt-6 pb-28 sm:px-6 md:px-8 lg:ml-[240px] lg:py-8">
            <div className="mx-auto w-full min-w-0 max-w-[640px] md:max-w-[960px] lg:max-w-none xl:max-w-[1200px] 2xl:max-w-[1360px]">{children}</div>
          </main>
          <BottomNav groups={groups} />
        </>
      ) : (
        <main className="min-w-0 overflow-x-clip px-4 pt-[80px] pb-8 sm:px-6 md:px-8 lg:ml-[240px] lg:py-8">
          <div className="mx-auto w-full min-w-0 max-w-[1560px]">{children}</div>
        </main>
      )}
    </div>
  );
}
