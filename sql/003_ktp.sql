-- db_koperasi · identitas anggota dari KTP: NIK, foto KTP, biodata hasil baca KTP

ALTER TABLE anggota ADD COLUMN IF NOT EXISTS nik      text;    -- 16 digit
ALTER TABLE anggota ADD COLUMN IF NOT EXISTS img_ktp  text;    -- nama berkas di storage/ktp/ (bukan URL; diambil lewat API)
ALTER TABLE anggota ADD COLUMN IF NOT EXISTS biodata  jsonb;   -- kolom KTP: tempat_lahir, tanggal_lahir, jenis_kelamin, agama, …
ALTER TABLE anggota ADD COLUMN IF NOT EXISTS metadata jsonb;   -- biodata + data lain anggota (no_hp, wilayah, bergabung, sumber isian)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anggota_nik_format') THEN
    ALTER TABLE anggota ADD CONSTRAINT anggota_nik_format CHECK (nik IS NULL OR nik ~ '^[0-9]{16}$');
  END IF;
END $$;

-- NIK unik per anggota (anggota lama boleh belum punya NIK)
CREATE UNIQUE INDEX IF NOT EXISTS anggota_nik_uq ON anggota (nik) WHERE nik IS NOT NULL;
