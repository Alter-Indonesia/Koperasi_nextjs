@AGENTS.md

# KoperasiKu — panduan proyek

Web simpan pinjam & penagihan koperasi. Next.js 16 (App Router) · REST API `/api/v1` · PostgreSQL `db_koperasi` · design system KoperasiKu (tema **Default**).
Role bawaan: **owner, admin, petugas** (penagih lapangan), **anggota** + role kustom (menu Sistem › Role). Tiap role punya **area** (`admin|owner|petugas|anggota`) = sidebar & halaman awal `/<area>`. Selesai: Admin dan Owner; Petugas & Anggota baru kerangka menu (aplikasi mobile menyusul).
Bahasa UI & pesan error: **Bahasa Indonesia**. **Nama tabel, kolom, field JSON API, dan kode: Bahasa Inggris** (`loans`, `installments`, `due_date`, `member_name`). Nilai data/enum tetap Indonesia (`status = 'aktif'`, `'lunas'`, kolektibilitas `Lancar/DPK/…`). URL (halaman & `/api/v1/pinjaman`, `/anggota`, …) tetap Indonesia.

## Wajib sebelum menulis kode
- Next 16 berbeda dari yang dikenal. Baca `node_modules/next/dist/docs/` untuk API yang dipakai (route handler, proxy, cache components). Heed deprecation.
- Ikuti pola yang sudah ada di bawah — **jangan** membuat pola baru bila pola lama bisa dipakai. Tiru halaman/endpoint yang paling mirip.
- Design system adalah sumber kebenaran: **jangan mengubah token, ukuran, atau bentuk komponen**. Bila butuh warna/ukuran baru, tambahkan dulu ke `design-system/` (dan beri tahu user), baru dipakai.

## Perintah
```bash
npm run dev          # http://localhost:3100  (port 3000 dipakai aplikasi lain di mesin user)
npm run db:setup     # buat db_koperasi (bila belum ada), migrasi sql/*.sql, seed
npm run db:migrate   # jalankan sql/*.sql yang BELUM dicatat di tabel _migrations (tiap file dijalankan sekali)
npm run db:seed      # kosongkan & isi ulang data contoh (juga menghapus semua sesi login)
npm run db:set-password  # atur password SEMUA pengguna ke SEED_PASSWORD (bcrypt) tanpa menyentuh data lain
npm run test:auth    # uji autentikasi (login, sesi, Bearer, kunci akun, 401/403) terhadap dev server yang berjalan
npm run test:docs    # dokumentasi OpenAPI (src/lib/openapi.ts) sinkron dengan semua route.ts
npx next typegen     # perlu dijalankan bila menambah/menghapus route (menghasilkan RouteContext & tipe rute)
npx tsc --noEmit && npx eslint src scripts && npm run build   # cek wajib sebelum selesai
```
PostgreSQL 14 lokal: port **5433**. Konfigurasi di `.env.local` (diabaikan git): `DATABASE_URL`, `SEED_PASSWORD`. Contoh di `.env.example`. **Jangan pernah** menulis password/secret ke file yang di-commit, README, atau output chat.

## Struktur
```
design-system/          sumber design system (FigCraft, tokens.css, README) — referensi, jangan diubah dari kode
layar-design-system/    mockup 26 layar (PNG + .figcraft) — acuan tampilan setiap halaman
sql/NNN_*.sql           migrasi berurut, dicatat di _migrations; view v_loans menghitung kolektibilitas dari hari telat (005 mendefinisikan ulang view-nya)
scripts/db.mjs          setup/migrate/seed (data contoh relatif terhadap hari ini)
src/styles/tokens.css   salinan apa adanya dari design-system/tokens.css
src/app/globals.css     memetakan token -> utilitas Tailwind; palet & skala bawaan Tailwind DIMATIKAN
src/components/ui/      komponen design system (Button, Badge/KolBadge, Chip, Avatar, Card/StatCard, Form*, Table/Pager, Modal, Toast, Progress)
src/components/layout/  AppShell, Sidebar (menu berkelompok + label pembatas), PageHeader, AreaShell/AreaGuard (layout per area), nav.ts (definisi menu per area), ComingSoon
src/components/crud/    EntityForm + EntityNewPage/EntityDetailPage: form halaman generik (baru/lihat/edit/hapus) untuk master data & sistem
src/app/<area>/         halaman per area: admin/* (anggota, pinjaman, …, master/*, sistem/*), owner/*, petugas/*, anggota/*; login/
src/app/api/v1/**       REST API (route handlers)
src/lib/                db, http (handle/ok/body), errors, auth, rbac (hak akses per role, cache), permissions (modul/aksi/area; aman untuk klien), activity (log aktivitas), api (klien), session, format, queries, openapi (spec dokumentasi API)
src/app/docs/route.ts   UI Scalar di /docs; spec disajikan di /api/v1/openapi.json (publik, terpisah dari login aplikasi; hanya bentuk API)
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
  Layout per area: `src/app/<area>/layout.tsx` memakai `<AreaGuard area>` (cek sesi + area di server) → `AreaShell` (sidebar dari `nav.ts`, disaring hak akses). **Menambah menu = tambah item di `components/layout/nav.ts` dengan `module`-nya.** Tiap kelompok menu punya label pembatas (MENU ADMIN · MASTER DATA · SISTEM, MENU OWNER, …).
- Mockup di `layar-design-system/default/<role>/*.png` adalah acuan visual. Halaman baru harus cocok dengan mockup-nya.
- Format tampilan lewat `src/lib/format.ts` (`rupiah`, `rupiahRingkas`, `tanggal*`, `jam`, `persen`, `inisial`). Jangan menulis ulang `toLocaleString` di halaman.
- Setiap halaman: loading → `<Skeleton>`, gagal → `<ErrorBox onRetry>`, kosong → `empty` di `<Table>`, aksi sukses/gagal → `<Toast>`. Form **tambah/lihat/ubah dibuat sebagai halaman** (bukan modal): `.../baru/page.tsx` dan `.../[id]/page.tsx` (tiru `admin/anggota/`; untuk entitas sederhana pakai `components/crud` seperti `admin/master/wilayah`; mode lihat → tombol Edit & Hapus di header, mode edit → tombol Simpan di bawah form). Kolom wajib diberi `<Field wajib>` (tanda `*`) dan pesan error per kolom. `<Modal>` hanya untuk dialog konfirmasi singkat (mis. hapus).

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
}, { module: "members" });                          // hak akses modul (aksi dari method HTTP); tanpa opsi = login saja; { public: true } = tanpa login
```
- Respons sukses `{ data, meta? }` (201 → `created()`), gagal `{ error: { message, details? } }`.
- Validasi body dengan **zod** lewat `body(req, Schema)`; query lewat `intParam`/`dateParam`/`idParam`. Kesalahan bisnis: `throw new HttpError(status, "pesan Indonesia")` (404 tidak ada, 409 sudah diproses, 422 aturan bisnis).
- `handle()` sudah mengurus: sesi 401, hak akses modul 403, cek Origin untuk non-GET (CSRF) 403, ZodError 400, HttpError, 500, `unstable_rethrow`, dan **log aktivitas** (setiap POST/PUT/PATCH/DELETE yang login dicatat: siapa, modul, aksi, path, status, IP; hanya nama kolom body, tidak pernah nilainya). Jangan menangkap error sendiri di handler kecuali perlu.
- **Hak akses**: `{ module }` memeriksa matriks role (`role_permissions`) — GET→view, POST→create, PUT/PATCH→update, DELETE→delete; timpa dengan `action`, beri nama aksi log dengan `log`. Modul baru: tambah ke `src/lib/permissions.ts` (MODULES, MODULE_ACTIONS) + migrasi yang mengisi `role_permissions` + item di `nav.ts`.
- Handler `route.ts` hanya boleh mengekspor GET/POST/…; skema zod bersama taruh di `src/lib/*-schema.ts`.
- Operasi multi-tabel: `tx(async (c) => …)` dari `src/lib/db.ts` + `FOR UPDATE` bila perlu. `verifikasi` adalah contoh (update saldo atomik).
- SQL bersama taruh di `src/lib/queries.ts`, bukan diekspor dari file `route.ts`. Uang `numeric(14,0)` → number; `date` → string `YYYY-MM-DD` (parser diatur di `db.ts`).
- Endpoint daftar: `?page&limit&q` + filter; `meta` memuat `total` & ringkasan yang dibutuhkan halaman.
- Menambah route → jalankan `npx next typegen`; dokumentasikan di tabel README **dan** di spec OpenAPI `src/lib/openapi.ts` (path, parameter, requestBody, respons 2xx + 401/403, schema di `components`). Dokumentasi interaktif (Scalar) di `/docs`; `npm run test:docs` (dev server jalan) harus lulus — ia gagal bila ada `route.ts` yang belum didokumentasikan.

## Pola database
- Migrasi baru = file `sql/00N_nama.sql` berikutnya. `scripts/db.mjs` mencatat file yang sudah jalan di `_migrations` dan tidak mengulangnya; tetap tulis dengan `IF NOT EXISTS` bila memungkinkan. Jangan mengedit migrasi lama yang sudah dijalankan; buat yang baru.
- **Kolom audit** di semua tabel data (kecuali `sessions` dan `activity_logs`): `created_at/created_by`, `updated_at/updated_by`, `deleted_at/deleted_by` (migrasi 004). `updated_at` diisi trigger; **endpoint yang menulis wajib mengisi `created_by`/`updated_by` dengan `currentUser().id`**. Tabel baru harus ikut kolom ini (+ trigger `trg_updated_at`).
- **Soft delete** (anggota, wilayah, tenor, pengguna, role): `DELETE` mengisi `deleted_at/deleted_by`, bukan menghapus baris. Query yang membaca tabel itu harus menyaring `deleted_at IS NULL` (view `v_loans` sudah). Unik (NIK, email, nama wilayah, lama tenor) dibuat partial index `WHERE deleted_at IS NULL`. Penghapusan ditolak (409) bila masih dipakai: anggota berpinjaman pengajuan/aktif, wilayah berisi anggota/pengguna, role dipakai pengguna; role bawaan & akun sendiri tidak bisa dihapus.
- Kolektibilitas **tidak disimpan**: dihitung di view `v_loans` dari hari telat angsuran tertua yang belum dibayar (≤30 DPK, ≤60 Kurang Lancar, ≤90 Diragukan, >90 Macet).
- Status: angsuran `belum|menunggu_verifikasi|lunas`; pembayaran `menunggu|terverifikasi|ditolak`; pinjaman `pengajuan|aktif|lunas|ditolak`. Pinjaman > Rp 20 jt → `pengajuan` (perlu Owner). Jasa 1,5%/bln flat.
- Tambah kolom/tabel baru → sesuaikan `scripts/db.mjs` (seed) bila perlu data contoh.

## Autentikasi
- Login `POST /api/v1/auth/login` → cookie `koperasi_sesi` (httpOnly, SameSite=Lax; 12 jam / 30 hari `remember`). Klien mobile/API: kirim `token: true` lalu pakai `Authorization: Bearer <token>` (token yang sama). Token acak; DB (`sessions`) menyimpan SHA-256-nya. Password **bcrypt** (`bcryptjs`, cost 12, maks. 72 byte) di `users.password_hash`, lewat `hashPassword`/`verifyPassword` di `src/lib/auth.ts`; 5× salah → kunci 15 menit. Skrip `scripts/db.mjs` memakai bcrypt yang sama.
- Sumber kebenaran sesi: `getSessionUser()`/`requireUser()` di `src/lib/auth.ts` (Data Access Layer). `proxy.ts` hanya optimistic redirect; **otorisasi sebenarnya selalu di API** (`handle(..., { module })`). Menu yang disaring di UI hanya kemudahan; jangan mengandalkannya.
- Hak akses per role diatur di menu Sistem › Role (tabel `roles`, `role_permissions`; cache 15 dtk di `lib/rbac.ts`, diinvalidasi saat role berubah). Role `admin` dikunci. Owner menyetujui pinjaman > Rp 20 jt lewat modul `loan_approvals`. Endpoint khusus petugas/anggota nanti **juga** harus membatasi data ke milik pengguna itu (mis. petugas hanya tagihan wilayahnya).
- `homePathFor(role)` (`auth.ts`) = `/<area role>`; layout area mengalihkan role yang salah area ke areanya sendiri.
- Dev server kadang menyajikan modul lama setelah banyak file berubah; bila hasil API tidak sesuai kode, mulai ulang `npm run dev`.

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
Isi aplikasi Petugas & Anggota (mobile; sekarang kerangka menu `ComingSoon`), ganti password oleh pengguna sendiri, edit/hapus pinjaman, akun login untuk anggota, pengiriman WhatsApp/SMS sungguhan (sekarang hanya mencatat ke `reminder_logs`), unggah foto bukti pembayaran (kolom `foto_bukti` baru menyimpan nama file; unggah foto KTP anggota sudah ada: `storage/ktp/`, OCR Tesseract lokal, model bahasa `storage/tessdata/ind.traineddata`).
