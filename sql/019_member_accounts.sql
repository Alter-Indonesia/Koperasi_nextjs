-- db_koperasi · akun login anggota (login memakai email ATAU no. HP)
--
-- members.user_id (sudah ada) menghubungkan anggota ke akun users (role 'anggota').
-- normalize_phone : '0812-5550-0101' / '+62 812 5550 0101' -> '08125550101' (digit saja, 62xx -> 0xx).
-- users_phone_uq  : no. HP unik antar akun (aktif) supaya login memakai no. HP tidak ambigu.
-- Akun dibuat otomatis untuk semua anggota yang ada (password_hash NULL = belum bisa login; Admin mengatur password di
-- Sistem › Pengguna, atau `npm run db:set-password`). Anggota yang no. HP-nya kosong / sudah dipakai akun lain tidak dibuatkan akun.
-- Modul baru: my_loans (beranda, pinjaman, dan profil anggota).

CREATE OR REPLACE FUNCTION normalize_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d = '' THEN NULL
    WHEN d LIKE '62%' THEN '0' || substr(d, 3)
    ELSE d
  END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '\D', '', 'g') AS d) x
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uq ON users (normalize_phone(phone))
  WHERE deleted_at IS NULL AND normalize_phone(phone) IS NOT NULL;

-- akun untuk anggota yang sudah ada
DO $$
DECLARE m record; uid int;
BEGIN
  FOR m IN
    SELECT DISTINCT ON (normalize_phone(phone)) id, member_number, name, phone, region_id, status
    FROM members
    WHERE deleted_at IS NULL AND user_id IS NULL AND normalize_phone(phone) IS NOT NULL
    ORDER BY normalize_phone(phone), id
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM users WHERE deleted_at IS NULL AND normalize_phone(phone) = normalize_phone(m.phone));
    CONTINUE WHEN EXISTS (SELECT 1 FROM users WHERE deleted_at IS NULL AND code = m.member_number);
    INSERT INTO users (code, name, phone, role, region_id, status)
    VALUES (m.member_number, m.name, m.phone, 'anggota', m.region_id, CASE WHEN m.status = 'aktif' THEN 'aktif' ELSE 'nonaktif' END)
    RETURNING id INTO uid;
    UPDATE members SET user_id = uid WHERE id = m.id;
  END LOOP;
END $$;

-- hak akses: Anggota melihat beranda/pinjaman/profil miliknya
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, 'my_loans', true, false, false, false FROM roles r WHERE r.code = 'anggota'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, 'my_loans', true, true, true, true FROM roles r WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;
