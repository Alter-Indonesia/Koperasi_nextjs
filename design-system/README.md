# KoperasiKu Design System v1.0

Satu sumber aturan tampilan untuk aplikasi **Admin, Owner, Petugas, dan Anggota**.
Tujuannya: siapa pun yang ngoding, ukuran tombol, warna, radius, dan komponennya tetap sama.

## Isi folder

| File | Untuk |
|---|---|
| `koperasi-design-system.figcraft` | File desain (FigCraft): variabel, text style, dan 34 *main component* |
| `01-fondasi.png` | Warna (4 tema), tipografi, spacing, radius, ukuran, ikon |
| `02-komponen.png` | Katalog komponen |
| `03-pratinjau-tema.png` | Komponen yang sama dalam 4 tema |
| `tokens.css` | **Sumber token untuk kode** (CSS custom properties) |
| `tokens.tailwind.css` | Versi Tailwind CSS v4 (`@theme`) |
| `tokens.json` | Format variabel FigCraft/Figma (bisa di-import ulang) |

## Dua lapis: Core dan Tema

- **Core (dikunci, sama di semua proyek):** `radius/*`, `space/*`, `size/*`, tipografi, ikon, bentuk komponen.
- **Tema (bisa diganti per proyek / dari DB):** hanya warna. Ada 4 mode: `Default`, `Sage Calm`, `Warm Sand`, `Dusty Blue`.

Komponen **tidak boleh** memakai kode hex langsung. Selalu pakai nama peran:

```css
.btn-primary { background: var(--bg-inverse); color: var(--accent-default); border-radius: var(--radius-md); height: 40px; }
.card        { background: var(--bg-card); border-radius: var(--radius-lg); padding: var(--space-5); }
.badge-telat { background: var(--warn-default); color: var(--fg-on-warn); border-radius: var(--radius-full); }
```

## Ganti tema

Tema default ada di `:root`. Tema lain aktif dengan atribut:

```html
<html data-tema="Warm Sand">
```

Nanti saat warna disimpan di DB: ambil nilai warna milik workspace, lalu tulis ulang variabel yang sama
(misalnya `document.documentElement.style.setProperty('--accent-default', warnaDariDb)`).
Core (ukuran, radius, spacing) tidak ikut disimpan di DB.

## Token warna

| Token | Dipakai untuk |
|---|---|
| `bg/canvas` | Latar halaman |
| `bg/card` | Kartu, panel, input |
| `bg/inverse` | Sidebar, tombol utama, kartu gelap |
| `bg/inverse-raised` | Elemen di atas sidebar/kartu gelap |
| `fg/default` · `fg/muted` · `fg/subtle` | Teks utama · sekunder · keterangan |
| `fg/inverse` · `fg/inverse-muted` · `fg/inverse-nav` | Teks di latar gelap |
| `fg/on-accent` · `fg/on-warn` | Teks di atas aksen · di atas peringatan |
| `accent/default` | Aksi utama, progres, menu aktif |
| `warn/default` · `warn/text` | Tunggakan/telat · teks peringatan & tautan |
| `line/default` · `line/subtle` | Border input & outline · garis pemisah |
| `chart/muted` | Batang target di grafik |
| `kol/lancar` … `kol/macet` | 5 tingkat kolektibilitas |

## Ukuran baku

Tombol tabel 30px · tombol 40px · tombol header 44px · CTA/input 52px · baris tabel 58px ·
sidebar 240px · bottom nav 76px · ikon 16px (Lucide, stroke 1.5) · mobile 390×844 · desktop 1440×960.

## Tipografi (Inter)

Angka KPI 28 Bold · Judul halaman 26 Bold · Judul mobile 22 Bold · App bar 18 Bold · Judul kartu 16 Bold ·
Body 14 Regular · Body tebal 14 Bold · Body kecil 13 · Small 12 · Caption 11 Medium · Overline 11 Bold huruf besar.

## Komponen (main component di FigCraft)

Button (Primary, Accent, Outline, Danger, Small) · Chip (Active, Default) · Badge kolektibilitas (5) ·
Status (Sudah bayar, Belum bayar, Telat) · Input (Text, Search) · Checkbox · Toggle · Nav sidebar ·
BottomNav · Avatar · Card/Stat · Progress · Table (Header, Row) · Card/Tagihan (mobile).

Aturan menambah komponen: pakai token yang ada; kalau butuh warna/ukuran baru, tambahkan dulu ke design system, baru dipakai di layar.
