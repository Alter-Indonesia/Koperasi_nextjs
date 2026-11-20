-- db_koperasi · kolom audit di semua tabel data + soft delete
--   created_at/created_by · updated_at/updated_by · deleted_at/deleted_by
-- `dibuat_pada` diganti nama menjadi `created_at`. Tabel `sesi` dikecualikan (data sementara, dihapus otomatis saat kedaluwarsa).
-- Dijalankan sekali saja (dicatat di _migrasi oleh scripts/db.mjs).

-- view bergantung pada kolom pinjaman (p.*): buang dulu, dibuat ulang di bawah
DROP VIEW IF EXISTS v_pinjaman;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wilayah', 'pengguna', 'anggota', 'pinjaman', 'angsuran', 'pembayaran', 'penugasan',
                           'pengingat_saluran', 'pengingat_aturan', 'pengingat_template', 'pengingat_log']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = t AND column_name = 'dibuat_pada')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = t AND column_name = 'created_at')
    THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN dibuat_pada TO created_at', t);
    END IF;
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by integer REFERENCES pengguna(id)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by integer REFERENCES pengguna(id)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by integer REFERENCES pengguna(id)', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END
$$;

-- NIK unik hanya untuk anggota yang belum dihapus (NIK anggota terhapus boleh didaftarkan ulang)
DROP INDEX IF EXISTS anggota_nik_uq;
CREATE UNIQUE INDEX anggota_nik_uq ON anggota (nik) WHERE nik IS NOT NULL AND deleted_at IS NULL;

-- kolektibilitas tetap dihitung di sini; pinjaman / anggota yang sudah dihapus tidak ikut
CREATE VIEW v_pinjaman AS
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
LEFT JOIN agg g ON g.pinjaman_id = p.id
WHERE p.deleted_at IS NULL AND a.deleted_at IS NULL;
