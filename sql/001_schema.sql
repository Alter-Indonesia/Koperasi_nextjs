-- db_koperasi · skema awal (simpan pinjam & penagihan)

CREATE TABLE IF NOT EXISTS wilayah (
  id    serial PRIMARY KEY,
  nama  text NOT NULL UNIQUE
);

-- Akun internal & anggota yang login (owner, admin, petugas, anggota)
CREATE TABLE IF NOT EXISTS pengguna (
  id              serial PRIMARY KEY,
  kode            text UNIQUE,                       -- mis. PTG-003
  nama            text NOT NULL,
  email           text UNIQUE,
  no_hp           text,
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'petugas', 'anggota')),
  wilayah_id      int REFERENCES wilayah(id),
  status          text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  login_terakhir  timestamptz,
  dibuat_pada     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anggota (
  id                  serial PRIMARY KEY,
  no_anggota          text NOT NULL UNIQUE,          -- AG-0412
  nama                text NOT NULL,
  no_hp               text,
  alamat              text,
  wilayah_id          int NOT NULL REFERENCES wilayah(id),
  bergabung           date NOT NULL DEFAULT CURRENT_DATE,
  status              text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  simpanan_pokok      numeric(14, 0) NOT NULL DEFAULT 0,
  simpanan_wajib      numeric(14, 0) NOT NULL DEFAULT 0,
  simpanan_sukarela   numeric(14, 0) NOT NULL DEFAULT 0,
  pengguna_id         int REFERENCES pengguna(id),
  dibuat_pada         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pinjaman (
  id             serial PRIMARY KEY,
  no_pinjaman    text NOT NULL UNIQUE,               -- PJ-24-0187
  anggota_id     int NOT NULL REFERENCES anggota(id),
  plafon         numeric(14, 0) NOT NULL CHECK (plafon > 0),
  tenor          int NOT NULL CHECK (tenor > 0),     -- bulan
  jasa_persen    numeric(5, 2) NOT NULL DEFAULT 1.5, -- % per bulan, flat
  angsuran       numeric(14, 0) NOT NULL,            -- per bulan
  tujuan         text,
  jaminan        text,
  tanggal_cair   date,
  status         text NOT NULL DEFAULT 'aktif' CHECK (status IN ('pengajuan', 'aktif', 'lunas', 'ditolak')),
  diajukan_oleh  int REFERENCES pengguna(id),
  dibuat_pada    timestamptz NOT NULL DEFAULT now()
);

-- Jadwal angsuran per pinjaman
CREATE TABLE IF NOT EXISTS angsuran (
  id            serial PRIMARY KEY,
  pinjaman_id   int NOT NULL REFERENCES pinjaman(id) ON DELETE CASCADE,
  ke            int NOT NULL,
  jatuh_tempo   date NOT NULL,
  pokok         numeric(14, 0) NOT NULL,
  jasa          numeric(14, 0) NOT NULL,
  total         numeric(14, 0) NOT NULL,
  status        text NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'menunggu_verifikasi', 'lunas')),
  UNIQUE (pinjaman_id, ke)
);
CREATE INDEX IF NOT EXISTS angsuran_jatuh_tempo_idx ON angsuran (jatuh_tempo);
CREATE INDEX IF NOT EXISTS angsuran_status_idx ON angsuran (status);

-- Pembayaran yang dicatat petugas / dikirim anggota, lalu diverifikasi admin
CREATE TABLE IF NOT EXISTS pembayaran (
  id                 serial PRIMARY KEY,
  angsuran_id        int NOT NULL REFERENCES angsuran(id) ON DELETE CASCADE,
  nominal            numeric(14, 0) NOT NULL,
  denda              numeric(14, 0) NOT NULL DEFAULT 0,
  metode             text NOT NULL CHECK (metode IN ('tunai', 'transfer', 'qris')),
  keterangan_metode  text,                           -- mis. Transfer BRI
  petugas_id         int REFERENCES pengguna(id),
  dibayar_pada       timestamptz NOT NULL DEFAULT now(),
  foto_bukti         text,
  lokasi             text,
  lat                numeric(9, 6),
  lng                numeric(9, 6),
  catatan            text,
  status             text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'terverifikasi', 'ditolak')),
  catatan_verifikasi text,
  diverifikasi_oleh  int REFERENCES pengguna(id),
  diverifikasi_pada  timestamptz
);
CREATE INDEX IF NOT EXISTS pembayaran_status_idx ON pembayaran (status);

-- Penugasan tagihan lapangan per hari
CREATE TABLE IF NOT EXISTS penugasan (
  id           serial PRIMARY KEY,
  angsuran_id  int NOT NULL REFERENCES angsuran(id) ON DELETE CASCADE,
  petugas_id   int NOT NULL REFERENCES pengguna(id),
  tanggal      date NOT NULL,
  dibuat_pada  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (angsuran_id, tanggal)
);

-- Pengingat tagihan
CREATE TABLE IF NOT EXISTS pengingat_saluran (
  kode       text PRIMARY KEY CHECK (kode IN ('whatsapp', 'sms', 'telepon', 'surat')),
  nama       text NOT NULL,
  deskripsi  text,
  aktif      boolean NOT NULL DEFAULT true,
  urutan     int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pengingat_aturan (
  id           serial PRIMARY KEY,
  offset_hari  int NOT NULL,                         -- -3 = H-3, 0 = hari H, 7 = H+7
  judul        text NOT NULL,
  keterangan   text,
  urutan       int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pengingat_template (
  kode     text PRIMARY KEY,                         -- H-3, H-1, HARI_H, TELAT
  saluran  text NOT NULL DEFAULT 'whatsapp',
  isi      text NOT NULL
);

CREATE TABLE IF NOT EXISTS pengingat_log (
  id            serial PRIMARY KEY,
  angsuran_id   int NOT NULL REFERENCES angsuran(id) ON DELETE CASCADE,
  saluran       text NOT NULL,
  dikirim_pada  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL CHECK (status IN ('terkirim', 'dibaca', 'gagal')),
  keterangan    text
);
CREATE INDEX IF NOT EXISTS pengingat_log_waktu_idx ON pengingat_log (dikirim_pada);

-- Ringkasan pinjaman + kolektibilitas (dihitung dari hari keterlambatan angsuran tertua yang belum dibayar)
CREATE OR REPLACE VIEW v_pinjaman AS
WITH agg AS (
  SELECT
    pinjaman_id,
    COALESCE(SUM(total) FILTER (WHERE status <> 'lunas'), 0)                       AS sisa,
    COUNT(*) FILTER (WHERE status = 'lunas')                                       AS angsuran_lunas,
    MIN(jatuh_tempo) FILTER (WHERE status <> 'lunas')                              AS jatuh_tempo_berikut,
    MIN(jatuh_tempo) FILTER (WHERE status = 'belum' AND jatuh_tempo < CURRENT_DATE) AS tertunggak_sejak,
    COALESCE(SUM(total) FILTER (WHERE status = 'belum' AND jatuh_tempo < CURRENT_DATE), 0) AS tunggakan
  FROM angsuran
  GROUP BY pinjaman_id
)
SELECT
  p.*,
  a.nama        AS anggota_nama,
  a.no_anggota,
  a.wilayah_id,
  w.nama        AS wilayah,
  COALESCE(g.sisa, 0)            AS sisa,
  COALESCE(g.angsuran_lunas, 0)  AS angsuran_lunas,
  g.jatuh_tempo_berikut,
  COALESCE(g.tunggakan, 0)       AS tunggakan,
  COALESCE(CURRENT_DATE - g.tertunggak_sejak, 0) AS hari_telat,
  CASE
    WHEN g.tertunggak_sejak IS NULL THEN 'Lancar'
    WHEN CURRENT_DATE - g.tertunggak_sejak <= 30 THEN 'DPK'
    WHEN CURRENT_DATE - g.tertunggak_sejak <= 60 THEN 'Kurang Lancar'
    WHEN CURRENT_DATE - g.tertunggak_sejak <= 90 THEN 'Diragukan'
    ELSE 'Macet'
  END AS kolektibilitas
FROM pinjaman p
JOIN anggota a ON a.id = p.anggota_id
JOIN wilayah w ON w.id = a.wilayah_id
LEFT JOIN agg g ON g.pinjaman_id = p.id;
