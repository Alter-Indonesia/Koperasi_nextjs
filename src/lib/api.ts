"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** Klien REST: semua halaman mengambil (pull) data dari /api/v1 */
export type ApiResult<T, M = Record<string, unknown>> = { data: T; meta?: M };

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T, M>(url: string, init?: RequestInit): Promise<ApiResult<T, M>> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  // sesi habis di tengah pemakaian -> kembali ke halaman login, lalu ke halaman ini lagi setelah masuk
  if (res.status === 401 && !url.startsWith("/api/v1/auth/") && typeof window !== "undefined") {
    // muat ulang penuh (bukan router.push) supaya semua state klien yang lama ikut dibuang
    window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  if (!res.ok) throw new ApiError(res.status, json?.error?.message ?? `Gagal memuat (${res.status})`, json?.error?.details);
  return json as ApiResult<T, M>;
}

export const api = {
  get: <T, M = Record<string, unknown>>(url: string) => request<T, M>(url),
  post: <T = unknown>(url: string, body: unknown) => request<T, unknown>(url, { method: "POST", body: JSON.stringify(body) }),
  patch: <T = unknown>(url: string, body: unknown) => request<T, unknown>(url, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T = unknown>(url: string, body: unknown) => request<T, unknown>(url, { method: "PUT", body: JSON.stringify(body) }),
};

/** Ambil data dari endpoint; `url = null` berarti jangan memuat. */
export function useApi<T, M = Record<string, unknown>>(url: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = url ? `${url}::${nonce}` : null;
  // `key` mencatat permintaan mana yang sudah selesai; data lama tetap tampil selama memuat ulang
  const [state, setState] = useState<{ key: string | null; data: T | null; meta: M | null; error: string | null }>({ key: null, data: null, meta: null, error: null });
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    if (!url || !key) return;
    let alive = true;
    api
      .get<T, M>(url)
      .then((r) => alive && setState({ key, data: r.data, meta: (r.meta ?? null) as M | null, error: null }))
      .catch((e: Error) => alive && setState((s) => ({ ...s, key, error: e.message })));
    return () => {
      alive = false;
    };
  }, [url, key]);
  return { data: state.data, meta: state.meta, error: state.key === key ? state.error : null, loading: key !== null && state.key !== key, reload };
}

/** Nilai `location.hash` tanpa "#" (untuk tautan seperti /admin/verifikasi#83) */
export function useHash() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash.slice(1),
    () => "",
  );
}

/** Event global setelah status pembayaran berubah (badge sidebar ikut dimuat ulang) */
export const PEMBAYARAN_BERUBAH = "koperasi:pembayaran-berubah";
export const umumkanPembayaranBerubah = () => window.dispatchEvent(new Event(PEMBAYARAN_BERUBAH));

export const qs =(p: Record<string, string | number | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined && v !== "") s.set(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : "";
};

/** Tunda nilai (untuk kolom cari) */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
