-- db_koperasi · master data: tenor (pilihan lama pinjaman) + wilayah bisa dikelola (soft delete)

CREATE TABLE IF NOT EXISTS tenors (
  id          serial PRIMARY KEY,
  months      int NOT NULL CHECK (months > 0 AND months <= 60),
  label       text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  integer REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  integer REFERENCES users(id),
  deleted_at  timestamptz,
  deleted_by  integer REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tenors_months_uq ON tenors (months) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_updated_at ON tenors;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON tenors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- nilai awal (sebelumnya daftar tetap di kode)
INSERT INTO tenors (months, sort_order)
SELECT m, row_number() OVER (ORDER BY m) FROM (VALUES (6), (10), (12), (18), (24), (36)) AS v(m)
WHERE NOT EXISTS (SELECT 1 FROM tenors);

-- nama wilayah unik hanya untuk yang belum dihapus
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'regions'::regclass AND contype = 'u' LOOP
    EXECUTE format('ALTER TABLE regions DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS regions_name_uq ON regions (lower(name)) WHERE deleted_at IS NULL;
