"use client";
import { BadgeCheck, BellRing, Eye, EyeOff, FileBarChart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Form";
import { api, ApiError, useApi } from "@/lib/api";

/** Hanya terima jalur internal (cegah open redirect ke situs lain) */
function tujuanAman(next: string | null, cadangan: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : cadangan;
}

const FITUR = [
  [BellRing, "Jadwal jatuh tempo & pengingat otomatis"],
  [BadgeCheck, "Pembayaran lapangan terverifikasi"],
  [FileBarChart, "Laporan kolektibilitas setiap saat"],
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [lihat, setLihat] = useState(false);
  const [ingat, setIngat] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // sudah login? langsung ke beranda
  const sesi = useApi<{ home: string }>("/api/v1/auth/me");
  useEffect(() => {
    if (sesi.data) router.replace(tujuanAman(new URLSearchParams(window.location.search).get("next"), sesi.data.home));
  }, [sesi.data, router]);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!identifier.trim() || !password) return setErr("Isi email/no. HP dan password");
    setBusy(true);
    try {
      const r = await api.post<{ home: string }>("/api/v1/auth/login", { identifier, password, remember: ingat });
      router.replace(tujuanAman(new URLSearchParams(window.location.search).get("next"), r.data.home));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Tidak dapat terhubung ke server");
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_560px]">
      <aside className="hidden flex-col justify-between bg-inverse p-12 lg:flex">
        <Logo inverse />
        <div className="max-w-[460px]">
          <h1 className="text-page font-bold text-fg-inverse">Simpan pinjam & penagihan, rapi dalam satu aplikasi.</h1>
          <p className="mt-3 text-body text-fg-inverse-muted">Admin, Owner, Petugas lapangan, dan Anggota bekerja dengan data yang sama, setiap hari.</p>
          <ul className="mt-8 flex flex-col gap-4">
            {FITUR.map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-ctl bg-accent text-on-accent"><Icon size={16} strokeWidth={1.5} /></span>
                <span className="text-body font-medium text-fg-inverse-nav">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-small text-fg-inverse-muted">KoperasiKu · Simpan Pinjam &amp; Penagihan</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-page font-bold text-fg">Masuk</h2>
          <p className="mt-1.5 text-body text-fg-muted">Masuk dengan email atau no. HP dan password akun koperasi Anda.</p>

          <form onSubmit={masuk} className="mt-8 flex flex-col gap-5" noValidate>
            <Field label="Email atau No. HP">
              <Input type="text" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="nama@koperasiku.id atau 0812-xxxx-xxxx" autoFocus />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input type={lihat ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-12" />
                <button type="button" onClick={() => setLihat(!lihat)} aria-label={lihat ? "Sembunyikan password" : "Tampilkan password"} className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-fg-muted">
                  {lihat ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                </button>
              </div>
            </Field>
            <label className="flex cursor-pointer items-center gap-3 text-body-sm text-fg">
              <Checkbox checked={ingat} onChange={setIngat} label="Ingat saya" />
              Ingat saya di perangkat ini (30 hari)
            </label>
            {err && (
              <div role="alert" className="rounded-ctl border border-warn bg-card px-4 py-3 text-body-sm font-medium text-warn-text">
                {err}
              </div>
            )}
            <Button type="submit" size="xl" className="w-full" disabled={busy}>
              {busy ? "Memeriksa…" : "Masuk"}
            </Button>
          </form>
          <p className="mt-6 text-small text-fg-subtle">Lupa password? Hubungi admin koperasi untuk mengatur ulang.</p>
        </div>
      </main>
    </div>
  );
}

function Logo({ inverse }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-[12px] bg-accent text-[22px] font-bold text-on-accent">K</span>
      <div>
        <div className={inverse ? "text-appbar font-bold text-fg-inverse" : "text-appbar font-bold text-fg"}>KoperasiKu</div>
        <div className={inverse ? "text-small text-fg-inverse-muted" : "text-small text-fg-muted"}>Simpan Pinjam</div>
      </div>
    </div>
  );
}
