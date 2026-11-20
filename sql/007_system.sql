-- db_koperasi · menu Sistem: role + hak akses per modul, log aktivitas, pengguna yang bisa dihapus (soft delete)

-- ---------- role ----------
CREATE TABLE IF NOT EXISTS roles (
  id           serial PRIMARY KEY,
  code         text NOT NULL UNIQUE,                        -- kode tetap (dipakai users.role)
  name         text NOT NULL,
  description  text,
  area         text NOT NULL CHECK (area IN ('admin', 'owner', 'petugas', 'anggota')),  -- area menu & halaman awal: /<area>
  is_system    boolean NOT NULL DEFAULT false,              -- 4 role bawaan: tidak bisa dihapus / diganti kodenya
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   integer REFERENCES users(id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   integer REFERENCES users(id),
  deleted_at   timestamptz,
  deleted_by   integer REFERENCES users(id)
);
DROP TRIGGER IF EXISTS trg_updated_at ON roles;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id     int NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module      text NOT NULL,
  can_view    boolean NOT NULL DEFAULT false,
  can_create  boolean NOT NULL DEFAULT false,
  can_update  boolean NOT NULL DEFAULT false,
  can_delete  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, module)
);

INSERT INTO roles (code, name, description, area, is_system) VALUES
  ('owner',   'Owner',            'Pemilik koperasi: memantau portofolio dan menyetujui pinjaman besar', 'owner',   true),
  ('admin',   'Admin',            'Mengelola data anggota, pinjaman, penagihan, master data, dan sistem', 'admin',   true),
  ('petugas', 'Petugas Lapangan', 'Penagih lapangan', 'petugas', true),
  ('anggota', 'Anggota',          'Anggota koperasi', 'anggota', true)
ON CONFLICT (code) DO NOTHING;

-- hak akses awal: admin = semua; owner = lihat + setujui pinjaman; petugas/anggota belum ada (aplikasi mobile menyusul)
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, m.module, true, true, true, true
FROM roles r CROSS JOIN (VALUES ('dashboard'), ('members'), ('loans'), ('due_dates'), ('payments'), ('assignments'), ('reminders'), ('reports'),
                                ('regions'), ('tenors'), ('users'), ('roles'), ('activity_logs')) AS m(module)
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, m.module, true, false, m.can_update, false
FROM roles r CROSS JOIN (VALUES ('dashboard', false), ('members', false), ('loans', true), ('due_dates', false), ('payments', false), ('assignments', false),
                                ('reminders', false), ('reports', false), ('regions', false), ('tenors', false), ('activity_logs', false)) AS m(module, can_update)
WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;

-- ---------- pengguna ----------
-- role boleh role kustom: ganti CHECK 4 nilai dengan FK ke roles(code)
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%role%' LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c);
  END LOOP;
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'u' LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c);   -- email & code unik hanya untuk yang belum dihapus (index di bawah)
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_fk') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_fk FOREIGN KEY (role) REFERENCES roles(code);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_code_uq  ON users (code) WHERE deleted_at IS NULL AND code IS NOT NULL;

-- ---------- log aktivitas ----------
CREATE TABLE IF NOT EXISTS activity_logs (
  id           bigserial PRIMARY KEY,
  user_id      integer REFERENCES users(id),
  user_name    text,                                  -- salinan nama saat kejadian
  action       text NOT NULL,                         -- login | logout | login_failed | create | update | delete | verify | ...
  module       text,
  entity_id    integer,
  method       text,
  path         text,
  status_code  integer,
  ip           text,
  user_agent   text,
  details      jsonb,                                 -- hanya nama kolom yang dikirim, TIDAK pernah nilainya (password, NIK, dst.)
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_user_idx    ON activity_logs (user_id);
CREATE INDEX IF NOT EXISTS activity_logs_module_idx  ON activity_logs (module);
