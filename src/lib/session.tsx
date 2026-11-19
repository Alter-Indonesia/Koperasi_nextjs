"use client";
import { createContext, useCallback, useContext } from "react";
import { api, useApi } from "@/lib/api";

export type Role = "owner" | "admin" | "petugas" | "anggota";
export type User = { id: number; kode: string | null; nama: string; email: string; role: Role; wilayah_id: number | null; wilayah: string | null };
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", petugas: "Petugas Lapangan", anggota: "Anggota" };

type Sesi = { user: User | null; loading: boolean; logout: () => Promise<void> };
const Ctx = createContext<Sesi>({ user: null, loading: true, logout: async () => {} });

/** Membaca pengguna yang login dari GET /api/v1/auth/me (401 otomatis dialihkan ke /login oleh klien API). */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data, loading } = useApi<{ user: User; beranda: string }>("/api/v1/auth/me");
  const logout = useCallback(async () => {
    await api.post("/api/v1/auth/logout", {}).catch(() => {});
    // muat ulang penuh & ganti riwayat: data halaman yang dilindungi tidak bisa dibuka lagi dengan tombol Back
    window.location.replace("/login");
  }, []);
  return <Ctx.Provider value={{ user: data?.user ?? null, loading, logout }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
