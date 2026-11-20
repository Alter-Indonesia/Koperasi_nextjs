"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PEMBAYARAN_BERUBAH, useApi } from "@/lib/api";
import { type Area } from "@/lib/permissions";
import { SessionProvider, useSession } from "@/lib/session";
import { AppShell } from "./AppShell";
import type { NavItem } from "./Sidebar";
import { NAV, type NavDef } from "./nav";

type Counts = { counts: { menunggu: number } };

function Shell({ area, children }: { area: Area; children: React.ReactNode }) {
  const { user, roleName, area: userArea, can, logout } = useSession();
  const router = useRouter();
  // pengguna dengan role di area lain dialihkan ke areanya sendiri (otorisasi sebenarnya tetap di API)
  useEffect(() => {
    if (userArea && userArea !== area) router.replace(`/${userArea}`);
  }, [userArea, area, router]);
  const allowed = userArea === area;
  const showBadge = allowed && can("payments", "view");
  const { meta, reload } = useApi<unknown, Counts>(showBadge ? "/api/v1/pembayaran?limit=1" : null);
  // halaman lain memicu event ini setelah verifikasi agar badge ikut diperbarui
  useEffect(() => {
    window.addEventListener(PEMBAYARAN_BERUBAH, reload);
    return () => window.removeEventListener(PEMBAYARAN_BERUBAH, reload);
  }, [reload]);

  const toItem = (i: NavDef): NavItem | null => {
    if (i.children) {
      const children = i.children.map(toItem).filter((c): c is NavItem => !!c);
      return children.length ? { href: i.href, label: i.label, icon: i.icon, children } : null; // induk disembunyikan bila tak ada anak yang boleh
    }
    if (i.module && !can(i.module, i.action ?? "view")) return null;
    return { href: i.href, label: i.label, icon: i.icon, exact: i.exact, badge: i.badge === "payments" ? meta?.counts.menunggu : undefined };
  };
  const groups = NAV[area]
    .map((g) => ({ label: g.label, items: g.items.map(toItem).filter((i): i is NavItem => !!i) }))
    .filter((g) => g.items.length > 0);

  return (
    <AppShell groups={groups} user={user ? { name: user.name, role: roleName ?? "" } : null} onLogout={logout}>
      {allowed ? children : null}
    </AppShell>
  );
}

/** Kerangka halaman satu area (admin | owner | petugas | anggota): sesi → sidebar menurut hak akses → konten. */
export function AreaShell({ area, children }: { area: Area; children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell area={area}>{children}</Shell>
    </SessionProvider>
  );
}
