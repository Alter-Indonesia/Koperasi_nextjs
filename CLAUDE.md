@AGENTS.md

# KoperasiKu — panduan proyek

Web simpan pinjam & penagihan koperasi. Next.js 16 (App Router) · REST API `/api/v1` · PostgreSQL `db_koperasi` · design system KoperasiKu (tema **Default**).
Role: **owner, admin, petugas** (penagih lapangan), **anggota**. Saat ini baru **Admin** yang selesai; Owner, Petugas (mobile), Anggota (mobile) belum.
Bahasa UI, pesan error, dan nama tabel/kolom: **Bahasa Indonesia**. Kode (nama fungsi/variabel umum) boleh Inggris, domain tetap Indonesia (`pinjaman`, `angsuran`, `jatuh_tempo`).

## Wajib sebelum menulis kode
- Next 16 berbeda dari yang dikenal. Baca `node_modules/next/dist/docs/` untuk API yang dipakai (route handler, proxy, cache components). Heed deprecation.
- Ikuti pola yang sudah ada di bawah — **jangan** membuat pola baru bila pola lama bisa dipakai. Tiru halaman/endpoint yang paling mirip.
- Design system adalah sumber kebenaran: **jangan mengubah token, ukuran, atau bentuk komponen**. Bila butuh warna/ukuran baru, tambahkan dulu ke `design-system/` (dan beri tahu user), baru dipakai.

## Perintah
```bash
npm run dev          # http://localhost:3100  (port 3000 dipakai aplikasi lain di mesin user)
npm run db:setup     # buat db_koperasi (bila belum ada), migrasi sql/*.sql, seed
npm run db:migrate   # hanya jalankan sql/*.sql (idempoten: IF NOT EXISTS)
npm run db:seed      # kosongkan & isi ulang data contoh (juga menghapus semua sesi login)
npm run db:set-password  # atur password SEMUA pengguna ke SEED_PASSWORD (bcrypt) tanpa menyentuh data lain
npm run test:auth    # 16 uji autentikasi terhadap dev server yang berjalan
npx next typegen     # perlu dijalankan bila menambah/menghapus route (menghasilkan RouteContext & tipe rute)
npx tsc --noEmit && npx eslint src scripts && npm run build   # cek wajib sebelum selesai
```
PostgreSQL 14 lokal: port **5433**. Konfigurasi di `.env.local` (diabaikan git): `DATABASE_URL`, `SEED_PASSWORD`. Contoh di `.env.example`. **Jangan pernah** menulis password/secret ke file yang di-commit, README, atau output chat.

## Struktur
```
design-system/          sumber design system (FigCraft, tokens.css, README) — referensi, jangan diubah dari kode
layar-design-system/    mockup 26 layar (PNG + .figcraft) — acuan tampilan setiap halaman
sql/NNN_*.sql           migrasi berurut, idempoten; view v_pinjaman menghitung kolektibilitas dari hari telat
scripts/db.mjs          setup/migrate/seed (data contoh relatif terhadap hari ini)
src/styles/tokens.css   salinan apa adanya dari design-system/tokens.css
src/app/globals.css     memetakan token -> utilitas Tailwind; palet & skala bawaan Tailwind DIMATIKAN
src/components/ui/      komponen design system (Button, Badge/KolBadge, Chip, Avatar, Card/StatCard, Form*, Table/Pager, Modal, Toast, Progress)
src/components/layout/  pola layout: AppShell, Sidebar, PageHeader
src/app/<role>/         halaman per role (sekarang: admin/*), login/, beranda/ (sementara untuk role lain)
src/app/api/v1/**       REST API (route handlers)
src/lib/                db, http (handle/ok/body), errors, auth, api (klien), session, format, queries
src/proxy.ts            cek cepat cookie -> redirect /login (BUKAN validasi sesi)
```

## Pola UI (design system)
- **Hanya utilitas dari token**: `bg-card`, `bg-canvas`, `bg-inverse`, `bg-accent`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `text-warn-text`, `border-line`, `rounded-card|ctl|chip|pill`, `text-kpi|page|mobile|appbar|title|body|body-sm|small|caption`. Warna Tailwind bawaan (`bg-blue-500`) tidak tersedia — jangan dihidupkan lagi. Jangan memakai hex langsung.
- Ukuran baku: tombol 30/40/44/52 (`sm|md|lg|xl`), sidebar 240, baris tabel 58, ikon Lucide 16 stroke 1.5. Kartu `rounded-card` (14) padding 20; jarak antar kartu `gap-6`; konten padding `px-8 py-8`.
- Gunakan komponen di `src/components/ui/`, jangan menggambar ulang tombol/badge/chip. Kolektibilitas selalu lewat `<KolBadge>`.
- **Pola halaman desktop** (Admin/Owner), tiru `src/app/admin/pinjaman/page.tsx` & `admin/page.tsx`:
  ```tsx
  <PageHeader title subtitle actions />         // judul 26, aksi tinggi 44 di kanan
  <div className="grid grid-cols-4 gap-6"><StatCard …/></div>   // KPI (kartu gelap = inverse)
  <Card title action={<CardLink/>}><Table columns rows rowKey/></Card>
  ```
  Sidebar/layout per role dipasang di `src/app/<role>/layout.tsx` (lihat `admin/AdminNav.tsx`): `SessionProvider` → `AppShell` → cek role di klien.
- Mockup di `layar-design-system/default/<role>/*.png` adalah acuan visual. Halaman baru harus cocok dengan mockup-nya.
- Format tampilan lewat `src/lib/format.ts` (`rupiah`, `rupiahRingkas`, `tanggal*`, `jam`, `persen`, `inisial`). Jangan menulis ulang `toLocaleString` di halaman.
- Setiap halaman: loading → `<Skeleton>`, gagal → `<ErrorBox onRetry>`, kosong → `empty` di `<Table>`, aksi sukses/gagal → `<Toast>`. Form di `<Modal>` dengan `<Field>`.

## Pola data di halaman (client)
- Ambil data **hanya** lewat REST: `useApi<T, Meta>(url | null)` dari `src/lib/api.ts` (pull), mutasi lewat `api.post/patch/put`. Jangan memakai server action atau query DB dari komponen.
- Parameter query dirakit dengan `qs({...})`; kolom cari memakai `useDebounced`. Ubah filter → `setPage(1)` **di event handler**, bukan di effect.
- Setelah mutasi: `reload()`; bila memengaruhi badge sidebar kirim `umumkanPembayaranBerubah()`.
- `useApi` otomatis mengarahkan ke `/login?next=…` saat API menjawab 401.
- Lint React 19 melarang `setState` sinkron di dalam `useEffect` (`react-hooks/set-state-in-effect`). Turunkan state dari props/data (nilai terturunkan), atau gunakan `useSyncExternalStore` (`useHash`). Jangan mematikan aturan lint.
- Dilarang `new Date()`/`Date.now()` di render Client Component (aturan prerender Next 16, memunculkan error "unstable value"). Ambil tanggal dari server (mis. `meta.tanggal`) atau lakukan di event handler/effect.

## Pola REST API
Satu file `route.ts` per sumber di `src/app/api/v1/…`. **Semua** endpoint dibungkus `handle()` (`src/lib/http.ts`):
```ts
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/v1/x/[id]">) => {
  const id = idParam((await ctx.params).id);
  const user = currentUser();                         // pengguna login (sudah diverifikasi)
  const rows = await q("SELECT …", [id]);             // SQL berparameter ($1…), TIDAK PERNAH string-concat input
  return ok(rows, { page, limit, total });            // { data, meta? }
}, { roles: ROLES.admin });                           // default: login role apa pun; { public: true } = tanpa login
```
- Respons sukses `{ data, meta? }` (201 → `created()`), gagal `{ error: { message, details? } }`.
- Validasi body dengan **zod** lewat `body(req, Schema)`; query lewat `intParam`/`dateParam`/`idParam`. Kesalahan bisnis: `throw new HttpError(status, "pesan Indonesia")` (404 tidak ada, 409 sudah diproses, 422 aturan bisnis).
- `handle()` sudah mengurus: sesi 401, role 403, cek Origin untuk non-GET (CSRF) 403, ZodError 400, HttpError, 500, dan `unstable_rethrow`. Jangan menangkap error sendiri di handler kecuali perlu.
- Operasi multi-tabel: `tx(async (c) => …)` dari `src/lib/db.ts` + `FOR UPDATE` bila perlu. `verifikasi` adalah contoh (update saldo atomik).
- SQL bersama taruh di `src/lib/queries.ts`, bukan diekspor dari file `route.ts`. Uang `numeric(14,0)` → number; `date` → string `YYYY-MM-DD` (parser diatur di `db.ts`).
- Endpoint daftar: `?page&limit&q` + filter; `meta` memuat `total` & ringkasan yang dibutuhkan halaman.
- Menambah route → jalankan `npx next typegen`; dokumentasikan di tabel README.

## Pola database
- Migrasi baru = file `sql/00N_nama.sql` berikutnya, **idempoten** (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE VIEW`). Jangan mengedit migrasi lama yang sudah dijalankan; buat yang baru.
- Kolektibilitas **tidak disimpan**: dihitung di view `v_pinjaman` dari hari telat angsuran tertua yang belum dibayar (≤30 DPK, ≤60 Kurang Lancar, ≤90 Diragukan, >90 Macet).
- Status: angsuran `belum|menunggu_verifikasi|lunas`; pembayaran `menunggu|terverifikasi|ditolak`; pinjaman `pengajuan|aktif|lunas|ditolak`. Pinjaman > Rp 20 jt → `pengajuan` (perlu Owner). Jasa 1,5%/bln flat.
- Tambah kolom/tabel baru → sesuaikan `scripts/db.mjs` (seed) bila perlu data contoh.

## Autentikasi
- Login `POST /api/v1/auth/login` → cookie `koperasi_sesi` (httpOnly, SameSite=Lax; 12 jam / 30 hari "ingat"). Token acak; DB (`sesi`) menyimpan SHA-256-nya. Password **bcrypt** (`bcryptjs`, cost 12, maks. 72 byte) di `pengguna.password_hash`, lewat `hashPassword`/`verifyPassword` di `src/lib/auth.ts`; 5× salah → kunci 15 menit. Skrip `scripts/db.mjs` memakai bcrypt yang sama.
- Sumber kebenaran sesi: `getSessionUser()`/`requireUser()` di `src/lib/auth.ts` (Data Access Layer). `proxy.ts` hanya optimistic redirect; **otorisasi sebenarnya selalu di API** (`handle(..., { roles })`). Jangan mengandalkan pengecekan role di UI saja.
- Role per endpoint: `ROLES.admin` = admin + owner. Endpoint khusus petugas/anggota nanti pakai role-nya sendiri **dan** batasi data ke milik pengguna itu (mis. petugas hanya tagihan wilayahnya).
- `BERANDA` di `auth.ts` memetakan role → halaman awal; ubah di sana saat halaman role baru selesai.

## Alur kerja saat diminta perubahan/penambahan
1. Cari pola terdekat (halaman/endpoint/komponen) dan tiru; baca mockup `layar-design-system/default/…` untuk UI.
2. Urutan membangun fitur: migrasi SQL → endpoint (`handle` + zod + role) → halaman memakai `useApi` + komponen design system → seed bila perlu.
3. Verifikasi: `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build` harus bersih. Uji endpoint dengan sesi (lihat `scripts/uji-auth.mjs` untuk cara login via fetch); cek halaman di browser pada lebar 1440 dan, untuk layar mobile, 390. Setelah tes yang mengubah data, `npm run db:seed` bila perlu mengembalikan data contoh.
4. Perbarui `README.md` (tabel API, daftar "belum dibuat") dan dokumen ini bila pola berubah.
5. Beri tahu user hal yang belum dibuat atau diasumsikan; jangan mengklaim selesai bila belum diuji.

## Git
- Repo: `https://github.com/Alter-Indonesia/Koperasi_nextjs.git`. `main` berisi commit awal; **semua commit dan push berikutnya memakai branch `asepdev2026`** (bukan `main`). Pastikan `git branch --show-current` = `asepdev2026` sebelum commit; push dengan `git push -u origin asepdev2026`. Jangan push ke `main` kecuali user memintanya.
- **Commit/push hanya bila user meminta.** Pesan commit Bahasa Indonesia ringkas (apa + kenapa). Jangan commit `.env*` (kecuali `.env.example`), `node_modules`, `.next`.
- Port 3000 di mesin ini milik aplikasi lain — jangan dihentikan; proyek ini 3100.

## Belum dibuat
Halaman Owner, aplikasi Petugas & Anggota (mobile), ganti/reset password & kelola pengguna, login anggota, pengiriman WhatsApp/SMS sungguhan (sekarang hanya mencatat ke `pengingat_log`), unggah foto bukti (kolom `foto_bukti` baru menyimpan nama file).
