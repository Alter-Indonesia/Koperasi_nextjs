-- db_koperasi · aplikasi Petugas: setoran kas, modul hak akses petugas, dan pengaturan setoran/target
--
-- cash_deposits : setoran uang tunai petugas ke kasir. Uang tunai "di tangan" = pembayaran tunai petugas yang belum
--                 punya deposit_id; POST /petugas/setoran menyetor semuanya sekaligus.
-- Modul baru    : my_tasks (tugas & profil petugas), my_deposits (setoran kas petugas).

CREATE TABLE IF NOT EXISTS cash_deposits (
  id            serial PRIMARY KEY,
  collector_id  int NOT NULL REFERENCES users(id),
  deposited_on  date NOT NULL DEFAULT CURRENT_DATE,
  amount        numeric(14, 0) NOT NULL CHECK (amount > 0),
  payment_count int NOT NULL CHECK (payment_count > 0),
  status        text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'cocok', 'selisih')),
  received_by   int REFERENCES users(id),             -- kasir yang menerima (diisi saat dicocokkan)
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    integer REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    integer REFERENCES users(id),
  deleted_at    timestamptz,
  deleted_by    integer REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS cash_deposits_collector_idx ON cash_deposits (collector_id, deposited_on DESC);
DROP TRIGGER IF EXISTS trg_updated_at ON cash_deposits;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON cash_deposits FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE payments ADD COLUMN IF NOT EXISTS deposit_id int REFERENCES cash_deposits(id);
CREATE INDEX IF NOT EXISTS payments_deposit_idx ON payments (collector_id) WHERE deposit_id IS NULL;

-- pengaturan: batas jam setor & target penagihan bulanan per petugas
INSERT INTO settings (key, group_name, label, description, value_type, value, config, sort_order)
SELECT 'deposit_deadline', 'Petugas', 'Batas setor kas', 'Jam terakhir petugas menyetor uang tunai ke kasir (format JJ:MM). Ditampilkan di halaman Setoran Kas petugas.',
       'text', '"17:00"'::jsonb, '{"max_length": 5}'::jsonb, 2
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'deposit_deadline');
INSERT INTO settings (key, group_name, label, description, value_type, value, config, sort_order)
SELECT 'collector_monthly_target', 'Petugas', 'Target penagihan bulanan per petugas', 'Dipakai untuk collection rate di halaman Profil petugas.',
       'number', '400000000'::jsonb, '{"min": 0, "step": 1000000, "prefix": "Rp"}'::jsonb, 3
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'collector_monthly_target');

-- hak akses: Petugas melihat tugas & setoran, boleh menyetor; Owner mengikuti matriks (kode tetap memberinya semua modul)
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, m.module, true, m.c, false, false
FROM roles r CROSS JOIN (VALUES ('my_tasks', false), ('my_deposits', true)) AS m(module, c)
WHERE r.code = 'petugas'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, m.module, true, true, true, true
FROM roles r CROSS JOIN (VALUES ('my_tasks'), ('my_deposits')) AS m(module)
WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;
