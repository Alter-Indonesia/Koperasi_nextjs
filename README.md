# KoperasiKu — Web Simpan Pinjam & Penagihan

Next.js 16 (App Router) · REST API `/api/v1` · PostgreSQL `db_koperasi` · design system KoperasiKu (tema **Default**).

## Menjalankan

```bash
npm install
cp .env.example .env.local      # isi password PostgreSQL (port 5433)
npm run db:setup                # buat db_koperasi, skema, dan data contoh
npm run dev                     # http://localhost:3100  (port 3000 dipakai aplikasi lain)
```

`npm run db:seed` mengosongkan lalu mengisi ulang data contoh (tanggal jatuh tempo dibuat relatif terhadap hari ini).
`npm run db:set-password` mengatur ulang password **semua** pengguna ke nilai `SEED_PASSWORD` (bcrypt) tanpa menyentuh data lain, dan mengeluarkan semua sesi login.

### Login (data contoh)

Buka http://localhost:3100/login. Semua pengguna memakai password yang sama, yaitu nilai `SEED_PASSWORD` di `.env.local`
(hanya untuk pengembangan — ganti sebelum dipakai sungguhan):

| Role | Email | Setelah login |
|---|---|---|
| Admin | rina@koperasiku.id | /admin |
| Owner | owner@koperasiku.id | /beranda (halaman Owner belum dibuat; API Admin boleh diakses) |
| Petugas | dedi@ · yanto@ · asep@ · lilis@koperasiku.id | /beranda (aplikasi Petugas belum dibuat) |

`npm run test:auth` menjalankan 16 uji autentikasi terhadap dev server yang sedang berjalan.

## Struktur

```
design-system/            sumber design system (FigCraft, tokens.css, README) — jangan diubah dari kode
layar-design-system/      mockup 26 layar (PNG + .figcraft)
sql/001_schema.sql        tabel + view v_pinjaman (kolektibilitas dihitung dari hari telat)
scripts/db.mjs            setup / migrate / seed
src/styles/tokens.css     salinan apa adanya dari design-system/tokens.css
src/app/globals.css       memetakan token -> utilitas Tailwind (palet & skala bawaan Tailwind dimatikan)
src/components/ui/        komponen design system: Button, Badge/KolBadge, Chip, Avatar, Card/StatCard,
                          SearchInput/Input/Select/Textarea, Toggle, Checkbox, Progress, Table/Pager, Modal, Toast
src/components/layout/    POLA LAYOUT: AppShell (sidebar 240 + konten padding 32) · Sidebar · PageHeader
src/app/admin/*           8 halaman Admin
src/app/api/v1/*          REST API (route handlers)
src/lib/                  db (pg Pool), http (format respons & error), api (klien fetch/useApi), format (Rupiah, tanggal)
```

### Pola layout halaman

Setiap halaman Admin/Owner mengikuti pola yang sama:

```tsx
<PageHeader title="…" subtitle="…" actions={<Button size="lg">…</Button>} />
<div className="grid grid-cols-4 gap-6"> <StatCard … /> … </div>   // KPI
<Card title="…" action={<CardLink href="…">Lihat semua</CardLink>}>  // panel
  <Table columns={…} rows={…} />
</Card>
```

Gunakan hanya utilitas dari token (mis. `bg-card`, `text-fg-muted`, `bg-accent`, `text-warn-text`, `rounded-card`,
`text-page`, `text-kpi`). Warna Tailwind bawaan (`bg-blue-500`, dst.) sengaja tidak tersedia.

## REST API (`/api/v1`)

Respons sukses `{ data, meta? }`, gagal `{ error: { message, details? } }`.

### Pola endpoint (pedoman)

```ts
// src/app/api/v1/<sumber>/route.ts
export const GET = handle(async (req) => {
  const user = currentUser();               // pengguna yang login (sudah diverifikasi)
  return ok(await q("SELECT …"), { page });  // { data, meta }
}, { roles: ROLES.admin });                  // tanpa opsi = wajib login role apa pun; { public: true } = tanpa login
```

`handle()` (src/lib/http.ts) menangani semuanya untuk setiap endpoint:
cek sesi → 401, cek role → 403, cek Origin untuk POST/PUT/PATCH/DELETE → 403 (CSRF), `zod` → 400, `HttpError` → status-nya, lainnya → 500.

### Autentikasi

| Metode | Endpoint | Fungsi |
|---|---|---|
| POST | `/auth/login` | `{ email, password, ingat }` → cookie `koperasi_sesi` (httpOnly, SameSite=Lax, 12 jam / 30 hari) |
| POST | `/auth/logout` | hapus sesi di DB & cookie |
| GET | `/auth/me` | pengguna yang login + halaman berandanya |

- Password di-hash **bcrypt** cost 12 (`pengguna.password_hash`, maks. 72 byte); cookie hanya berisi token acak, DB menyimpan SHA-256-nya (tabel `sesi`).
- 5 kali salah password → akun dikunci 15 menit (`429`). Email tidak terdaftar & password salah memberi pesan yang sama.
- `src/proxy.ts` hanya cek cepat cookie untuk mengalihkan halaman `/admin` & `/beranda` ke `/login?next=…`;
  validasi sesi yang sebenarnya selalu di API. Klien (`src/lib/api.ts`) otomatis kembali ke login saat API menjawab 401.

### Data

| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/dashboard` | KPI, alur penagihan hari ini, pembayaran menunggu, kinerja petugas |
| GET, POST | `/pinjaman` | daftar (filter `kolektibilitas`, `q`, `page`) · buat pinjaman + jadwal angsuran (> Rp 20 jt → `pengajuan`) |
| GET | `/pinjaman/:id` | detail + jadwal angsuran |
| GET, POST | `/anggota` | daftar (filter `wilayah_id`, `q`, `page`) + statistik · anggota baru |
| GET | `/jatuh-tempo` | angsuran jatuh tempo s.d. `tanggal`, ringkasan mingguan (`status=semua|belum|telat`) |
| GET | `/pembayaran` | antrean (`status=menunggu|terverifikasi|ditolak`) |
| GET | `/pembayaran/:id` | detail bukti + sisa pinjaman sebelum/sesudah |
| POST | `/pembayaran/:id/verifikasi` | `{ aksi: "verifikasi" \| "tolak", catatan }` → update saldo / tagih ulang |
| GET, POST | `/penugasan` | tagihan belum ditugaskan + beban petugas (`tanggal`, default besok) · tugaskan |
| POST | `/penugasan/otomatis` | bagi otomatis per wilayah |
| GET | `/pengingat` | saluran, aturan, template, log hari ini |
| POST | `/pengingat/kirim` | catat pengingat (`angsuran_ids` atau `semua_jatuh_tempo`) |
| PATCH | `/pengingat/saluran/:kode` | aktif/nonaktif saluran |
| PUT | `/pengingat/template/:kode` | ubah isi template |
| GET | `/laporan/penagihan` | rekap per petugas, metode, harian, umur tunggakan, penagihan lanjutan (`dari`, `sampai`, `wilayah_id`) |
| GET | `/wilayah`, `/petugas` | data referensi |

## Belum dibuat

- Ganti / reset password dan kelola pengguna (menu Owner "Pengguna & Akses").
- Login anggota (akun `pengguna` role `anggota` belum dibuat di data contoh).
- Pengiriman WhatsApp/SMS sungguhan — `POST /pengingat/kirim` baru mencatat ke `pengingat_log`.
- Unggah foto bukti (kolom `foto_bukti` baru menyimpan nama file).
- Halaman Owner, Petugas (mobile), dan Anggota (mobile).
