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
| Owner | owner@koperasiku.id | /owner (dashboard, persetujuan pinjaman > Rp 20 jt, laporan) |
| Petugas | dedi@ · yanto@ · asep@ · lilis@koperasiku.id | /petugas (Tugas Hari Ini, Setoran Kas, Profil) |

Sidebar tiap role berlabel area (MENU ADMIN · MASTER DATA · SISTEM, MENU OWNER, MENU PETUGAS, MENU ANGGOTA) dan disaring menurut hak akses role.
Hak akses diatur di **Sistem › Role** (matriks modul × aksi).

`npm run test:auth` menjalankan uji autentikasi terhadap dev server yang sedang berjalan.

## Proses bisnis

Skema alur kerja tiap role ada di `docs/proses-bisnis/` (diagram dapat diedit di `proses-bisnis.figcraft`):

| Gambar | Isi |
|---|---|
| `0-lintas-role-proses-bisnis.png` | Alur satu pinjaman lintas Anggota, Petugas, Admin, Owner (swimlane) |
| `1-admin-proses-bisnis.png` | Admin: anggota → pinjaman → jatuh tempo → pengingat → penugasan → verifikasi (6A/6B) → penagihan lanjutan → laporan |
| `2-owner-proses-bisnis.png` | Owner: ringkasan, persetujuan pinjaman > Rp 20 juta, kolektibilitas & NPL, kinerja petugas, laporan keuangan, pengguna |
| `3-petugas-proses-bisnis.png` | Petugas: tugas harian, rute, penagihan, input pembayaran, setor kas |
| `4-anggota-proses-bisnis.png` | Anggota: pengajuan, jadwal angsuran, pengingat, pembayaran, verifikasi, simpanan |

Garis putus-putus pada gambar berarti layar role tersebut belum dibuat (mockup sudah ada); hanya Admin yang sudah jadi.
Bila aturan bisnis berubah (batas persetujuan, jadwal pengingat, aturan penagihan lanjutan), perbarui gambar ini.

## Struktur

```
design-system/            sumber design system (FigCraft, tokens.css, README) — jangan diubah dari kode
layar-design-system/      mockup 26 layar (PNG + .figcraft)
docs/proses-bisnis/       skema proses bisnis tiap role (PNG + .figcraft), lihat bagian "Proses bisnis"
sql/NNN_*.sql             migrasi berurut (dicatat di _migrations); nama tabel & kolom Inggris sejak 005; view v_loans = kolektibilitas dari hari telat
scripts/db.mjs            setup / migrate / seed
src/styles/tokens.css     salinan apa adanya dari design-system/tokens.css
src/app/globals.css       memetakan token -> utilitas Tailwind (palet & skala bawaan Tailwind dimatikan)
src/components/ui/        komponen design system: Button, Badge/KolBadge, Chip, Avatar, Card/StatCard,
                          SearchInput/Input/Select/Textarea, Toggle, Checkbox, Progress, Table/Pager, Modal, Toast
src/components/layout/    POLA LAYOUT: AppShell (sidebar 240 + konten padding 32) · Sidebar (menu berkelompok berlabel) · PageHeader · nav.ts (menu per area)
src/components/crud/      form halaman generik (tambah / lihat / ubah / hapus) untuk master data & sistem
src/app/admin/*           Admin: anggota, pinjaman, jatuh tempo, verifikasi, penugasan, pengingat, laporan · master/(wilayah, tenor) · sistem/(pengguna, role, log-aktivitas)
src/app/owner/*           Owner: dashboard, persetujuan pinjaman, laporan
src/app/petugas/*   Tugas Hari Ini, Setoran Kas (/riwayat), Profil · src/app/anggota/*   kerangka menu (aplikasi mobile menyusul)
src/app/api/v1/*          REST API (route handlers)
src/lib/                  db (pg Pool), http (format respons & error), api (klien fetch/useApi), format (Rupiah, tanggal), openapi (spec dokumentasi API)
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

### Dokumentasi API (Scalar)

Dokumentasi interaktif ada di **http://localhost:3100/docs** (spec OpenAPI 3.1 di `/api/v1/openapi.json`).
`/docs` dan spec-nya terbuka tanpa login (terpisah dari aplikasi). Untuk mencoba endpoint data, login dulu di `/login` pada browser yang sama; tombol **Test Request** memakai cookie sesi itu.

- Spec ditulis di `src/lib/openapi.ts`. Menambah/mengubah endpoint → perbarui file itu di commit yang sama.
- `npm run test:docs` (dev server harus jalan) memastikan semua `route.ts` terdokumentasi, tidak ada dokumentasi yatim, semua `$ref` valid, dan tiap operasi punya tag, ringkasan, respons sukses, serta 401 bila wajib login.
- Telemetri Scalar dimatikan. Skrip UI Scalar dimuat dari CDN jsDelivr, jadi `/docs` butuh internet; `/api/v1/openapi.json` tidak.

### Autentikasi

| Metode | Endpoint | Fungsi |
|---|---|---|
| POST | `/auth/login` | `{ email, password, remember, token? }` → cookie `koperasi_sesi` (httpOnly, SameSite=Lax, 12 jam / 30 hari); `token: true` juga mengembalikan token Bearer untuk klien mobile/API |
| POST | `/auth/logout` | hapus sesi di DB & cookie |
| GET | `/auth/me` | pengguna, `role_name`, `area`, `home`, dan `permissions` per modul |

- Password di-hash **bcrypt** cost 12 (`users.password_hash`, maks. 72 byte); cookie hanya berisi token acak, DB menyimpan SHA-256-nya (tabel `sessions`).
- 5 kali salah password → akun dikunci 15 menit (`429`). Email tidak terdaftar & password salah memberi pesan yang sama.
- `src/proxy.ts` hanya cek cepat cookie untuk mengalihkan halaman `/admin`, `/owner`, `/petugas`, `/anggota` ke `/login?next=…`;
  validasi sesi yang sebenarnya selalu di API. Klien (`src/lib/api.ts`) otomatis kembali ke login saat API menjawab 401.

### Data

| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/dashboard` | KPI, alur penagihan hari ini, pembayaran menunggu, kinerja petugas |
| GET, POST | `/pinjaman` | daftar (filter `collectibility`, `q`, `page`) · buat pinjaman + jadwal angsuran (> Rp 20 jt → `pengajuan`) |
| GET | `/pinjaman/:id` | detail + jadwal angsuran |
| GET, POST | `/anggota` | daftar (filter `region_id`, `q`, `page`) + statistik · anggota baru (wajib `national_id`; `biodata` dari KTP) |
| GET, PATCH, DELETE | `/anggota/{id}` | detail (biodata, jejak audit, pinjaman) · ubah · **soft delete** (ditolak 409 bila masih punya pinjaman pengajuan/aktif) |
| POST | `/anggota/baca-ktp` | baca foto KTP (OCR Tesseract lokal, multipart `foto`) → `national_id` + `biodata`; tidak menyimpan |
| GET, POST | `/anggota/{id}/ktp` | ambil / unggah foto KTP (disimpan di `storage/ktp/`, hanya lewat API, wajib login) |
| GET | `/jatuh-tempo` | angsuran jatuh tempo s.d. `date`, ringkasan mingguan (`status=all|unpaid|overdue`) |
| GET | `/pembayaran` | antrean (`status=menunggu|terverifikasi|ditolak`) |
| GET | `/pembayaran/:id` | detail bukti + sisa pinjaman sebelum/sesudah |
| POST | `/pembayaran/:id/verifikasi` | `{ action: "verify" \| "reject", notes }` → update saldo / tagih ulang |
| GET, POST | `/penugasan` | tagihan belum ditugaskan + beban petugas (`tanggal`, default besok) · tugaskan |
| POST | `/penugasan/otomatis` | bagi otomatis per wilayah |
| GET | `/pengingat` | saluran, aturan, template, log hari ini |
| POST | `/pengingat/kirim` | catat pengingat (`installment_ids` atau `all_due`) |
| PATCH | `/pengingat/saluran/:kode` | aktif/nonaktif saluran |
| PUT | `/pengingat/template/:kode` | ubah isi template |
| GET | `/laporan/penagihan` | rekap per petugas, metode, harian, umur tunggakan, penagihan lanjutan (`from`, `to`, `region_id`) |
| GET | `/petugas` | petugas lapangan aktif (referensi) |
| GET | `/petugas/tugas` | **Petugas** — tagihan yang ditugaskan kepada saya hari ini (modul `my_tasks`) |
| POST | `/petugas/tugas/{id}/bayar` | **Petugas** — catat pembayaran angsuran (`method`: tunai/transfer) → status `menunggu`, diverifikasi admin |
| POST | `/petugas/tugas/{id}/tunda` | **Petugas** — tunda tagihan ke `promised_on` (maks. 30 hari) + `reason`; ditugaskan ulang pada tanggal itu |
| GET, POST | `/petugas/setoran` | **Petugas** — uang tunai di tangan, rincian hari ini, riwayat · setor semua tunai ke kasir (modul `my_deposits`) |
| GET | `/petugas/profil` | **Petugas** — profil + capaian bulan ini terhadap target (modul `my_tasks`) |
| GET, POST | `/wilayah` | **Master Data** — daftar wilayah · tambah |
| GET, PATCH, DELETE | `/wilayah/{id}` | detail · ubah · soft delete (ditolak bila masih dipakai anggota/pengguna) |
| GET, PATCH | `/pengaturan` | **Sistem › Pengaturan** — daftar pengaturan (tabel `settings`, key/value dinamis) · ubah beberapa sekaligus `{ values: { key: nilai } }` |
| GET | `/pinjaman/pengaturan` | perlakuan biaya admin yang berlaku (`admin_fee_mode`: `potong`/`tambah`) untuk form pinjaman |
| GET, POST | `/tenor` | **Master Data** — pilihan tenor **bulanan/harian** (`unit`), `duration`, dan jasa `interest_rate_percent` (% flat per bulan/hari) (`?active=1` = hanya aktif) · tambah. `POST /pinjaman` memakai `tenor_id` dari tabel ini |
| GET, PATCH, DELETE | `/tenor/{id}` | detail · ubah · soft delete |
| GET, POST | `/pengguna` | **Sistem** — daftar (`q`, `role`, `status`, `page`) · tambah (password awal bcrypt) |
| GET, PATCH, DELETE | `/pengguna/{id}` | detail · ubah (`password` memutus sesi) · soft delete (akun sendiri tidak bisa dihapus) |
| GET, POST | `/role` | **Sistem** — daftar role · tambah role kustom |
| GET, PATCH, DELETE | `/role/{id}` | detail + hak akses · ubah · soft delete (role bawaan / yang dipakai ditolak) |
| PUT | `/role/{id}/permissions` | ganti matriks hak akses role (role `owner` = superadmin dikunci) |
| GET | `/log-aktivitas`, `/log-aktivitas/{id}` | **Sistem** — log login & perubahan data (hanya baca; filter `q`, `module`, `action`, `from`, `to`) |
| GET | `/persetujuan`, `/persetujuan/{id}` | pengajuan pinjaman > Rp 20 jt yang menunggu Owner |
| POST | `/persetujuan/{id}` | `{ action: "approve" \| "reject", notes }` — keputusan Owner (jadwal angsuran dibuat saat disetujui) |

Catatan: nama tabel, kolom, dan **field JSON** memakai bahasa Inggris (mis. `loan_number`, `due_date`, `member_name`); URL tetap Indonesia.
Parameter query: `date` (`/jatuh-tempo`, `/penugasan`), `from`/`to` (`/laporan/penagihan`), `region_id`, `collectibility`. Setiap perubahan data dicatat di Log Aktivitas.

## Belum dibuat

- Ganti password oleh pengguna sendiri (admin sudah bisa mengganti lewat Sistem › Pengguna).
- Login anggota (akun role `anggota` belum dibuat di data contoh).
- Pengiriman WhatsApp/SMS sungguhan — `POST /pengingat/kirim` baru mencatat ke `reminder_logs`.
- Unggah foto bukti pembayaran (kolom `foto_bukti` baru menyimpan nama file; unggah foto KTP anggota sudah ada).
- Isi aplikasi Petugas dan Anggota (mobile) — sekarang baru kerangka menu.
- Edit / hapus pinjaman (baru lihat detail).
