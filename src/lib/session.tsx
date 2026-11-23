"use client";
import { createContext, useCallback, useContext } from "react";
import { api, useApi } from "@/lib/api";
import { can as canDo, type Action, type Area, type Module, type PermissionMap } from "@/lib/permissions";

export type Role = string;
export type User = { id: number; code: string | null; name: string; email: string | null; role: Role; region_id: number | null; region_name: string | null };

type Me = { user: User; role_name: string; area: Area; home: string; permissions: PermissionMap };
type Sesi = {
  user: User | null;
  roleName: string | null;
  area: Area | null;
  permissions: PermissionMap;
  loading: boolean;
  logout: () => Promise<void>;
  can: (module: Module, action?: Action) => boolean;
};
const Ctx = createContext<Sesi>({ user: null, roleName: null, area: null, permissions: {}, loading: true, logout: async () => {}, can: () => false });

/** Membaca pengguna, role, area menu, dan hak akses dari GET /api/v1/auth/me (401 otomatis dialihkan ke /login oleh klien API). */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data, loading } = useApi<Me>("/api/v1/auth/me");
  const logout = useCallback(async () => {
    await api.post("/api/v1/auth/logout", {}).catch(() => {});
    // muat ulang penuh & ganti riwayat: data halaman yang dilindungi tidak bisa dibuka lagi dengan tombol Back
    window.location.replace("/login");
  }, []);
  const permissions = data?.permissions ?? {};
  return (
    <Ctx.Provider value={{ user: data?.user ?? null, roleName: data?.role_name ?? null, area: data?.area ?? null, permissions, loading, logout, can: (m, a) => canDo(permissions, m, a) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
