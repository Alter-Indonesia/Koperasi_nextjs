"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Form";
import { api, ApiError } from "@/lib/api";

const KOSONG = { current_password: "", new_password: "", confirm: "" };

/** Form ganti password sendiri (profil Petugas & Anggota); berhasil -> semua sesi diputus server, lalu masuk ulang. */
export function ChangePasswordForm({ url }: { url: string }) {
  const [f, setF] = useState(KOSONG);
  const [err, setErr] = useState<Partial<Record<keyof typeof KOSONG, string>>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const set = (k: keyof typeof KOSONG) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const x: typeof err = {};
    if (!f.current_password) x.current_password = "Password saat ini wajib diisi";
    if (f.new_password.length < 8) x.new_password = "Password baru minimal 8 karakter";
    if (f.confirm !== f.new_password) x.confirm = "Konfirmasi tidak sama dengan password baru";
    setErr(x);
    if (Object.keys(x).length) return;
    setBusy(true);
    try {
      await api.post(url, { current_password: f.current_password, new_password: f.new_password });
      setF(KOSONG);
      setToast({ m: "Password diganti · silakan masuk kembali", t: "ok" });
      setTimeout(() => window.location.replace("/login"), 1500);
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal mengganti password", t: "warn" });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={simpan} className="flex h-full flex-col gap-4 rounded-card bg-card p-5">
      <div>
        <p className="text-body font-bold text-fg">Ganti password</p>
        <p className="text-body-sm text-fg-muted">Setelah diganti, Anda harus masuk kembali di semua perangkat.</p>
      </div>
      <Field label="Password saat ini" wajib error={err.current_password}><Input type="password" autoComplete="current-password" value={f.current_password} onChange={set("current_password")} /></Field>
      <Field label="Password baru" wajib error={err.new_password}><Input type="password" autoComplete="new-password" value={f.new_password} onChange={set("new_password")} placeholder="Minimal 8 karakter" /></Field>
      <Field label="Ulangi password baru" wajib error={err.confirm}><Input type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} /></Field>
      <Button type="submit" variant="accent" size="lg" className="mt-auto" disabled={busy}>Simpan password</Button>
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </form>
  );
}
