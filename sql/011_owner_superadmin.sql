-- db_koperasi · Owner = superadmin (kendali penuh, terkunci); Admin = operasional tanpa menu Sistem
--
-- Owner: semua modul, semua aksi. Hak Owner juga ditetapkan di kode (lib/rbac.ts) sehingga modul baru otomatis ikut
-- dan Owner tidak mungkin terkunci dari sistem; baris di sini agar matriks hak akses menampilkannya dengan benar.
-- Admin: mengelola data operasional; hanya lihat Persetujuan Pinjaman; tanpa Pengguna, Role, Log Aktivitas, dan Pengaturan.

DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code IN ('owner', 'admin'));

INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, m.module, true, true, true, true
FROM roles r CROSS JOIN (VALUES
  ('dashboard'), ('members'), ('loans'), ('loan_approvals'), ('due_dates'), ('payments'), ('assignments'), ('reminders'), ('reports'),
  ('regions'), ('tenors'), ('users'), ('roles'), ('activity_logs'), ('settings')
) AS m(module)
WHERE r.code = 'owner';

INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, m.module, true, m.c, m.u, m.d
FROM roles r CROSS JOIN (VALUES
  ('dashboard',      false, false, false),
  ('members',        true,  true,  true),
  ('loans',          true,  true,  true),
  ('loan_approvals', false, false, false),
  ('due_dates',      false, false, false),
  ('payments',       false, true,  false),
  ('assignments',    true,  false, false),
  ('reminders',      true,  true,  false),
  ('reports',        false, false, false),
  ('regions',        true,  true,  true),
  ('tenors',         true,  true,  true)
) AS m(module, c, u, d)
WHERE r.code = 'admin';
