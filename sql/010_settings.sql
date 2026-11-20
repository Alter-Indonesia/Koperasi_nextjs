-- db_koperasi · tabel pengaturan sistem (key/value dinamis) + perlakuan biaya admin per pinjaman
--
-- Menambah pengaturan baru = INSERT satu baris di tabel ini (tanpa ubah kode/skema); menu Sistem › Pengaturan
-- membuat kolom isiannya otomatis dari value_type + config:
--   text    : config { max_length }
--   number  : config { min, max, step, prefix, suffix }
--   boolean : (tanpa config)
--   select  : config { options: [{ value, label }] }

CREATE TABLE IF NOT EXISTS settings (
  id          serial PRIMARY KEY,
  key         text NOT NULL,
  group_name  text NOT NULL DEFAULT 'Umum',
  label       text NOT NULL,
  description text,
  value_type  text NOT NULL CHECK (value_type IN ('text', 'number', 'boolean', 'select')),
  value       jsonb,
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  integer REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  integer REFERENCES users(id),
  deleted_at  timestamptz,
  deleted_by  integer REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS settings_key_uq ON settings (key) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_updated_at ON settings;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- pengaturan pertama: perlakuan biaya admin pinjaman
INSERT INTO settings (key, group_name, label, description, value_type, value, config, sort_order)
SELECT 'admin_fee_mode', 'Pinjaman', 'Perlakuan biaya admin',
       'Pengurang: pinjam Rp 10 jt dengan biaya admin Rp 200 rb, dana yang diterima Rp 9,8 jt dan angsuran dihitung dari Rp 10 jt. '
       || 'Penambah: dana yang diterima tetap Rp 10 jt, pokok yang harus dibayar menjadi Rp 10,2 jt dan angsuran dihitung dari jumlah itu. '
       || 'Berlaku untuk pinjaman baru; pinjaman yang sudah ada tidak berubah.',
       'select', '"potong"'::jsonb,
       '{"options": [{"value": "potong", "label": "Pengurang plafon (dana diterima dipotong biaya admin)"}, {"value": "tambah", "label": "Penambah plafon (biaya admin ditambahkan ke pokok pinjaman)"}]}'::jsonb,
       1
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'admin_fee_mode');

-- loans: perlakuan biaya admin dicatat per pinjaman (pengaturan bisa berubah, pinjaman lama tidak ikut berubah)
ALTER TABLE loans ADD COLUMN IF NOT EXISTS admin_fee_mode text NOT NULL DEFAULT 'potong' CHECK (admin_fee_mode IN ('potong', 'tambah'));

-- modul hak akses baru: settings (Admin: lihat + ubah)
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, 'settings', true, false, true, false
FROM roles r WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- view dibuat ulang agar memuat kolom baru
DROP VIEW IF EXISTS v_loans;
CREATE VIEW v_loans AS
WITH agg AS (
  SELECT
    loan_id,
    COALESCE(SUM(total_amount) FILTER (WHERE status <> 'lunas'), 0)                                       AS remaining_balance,
    COUNT(*) FILTER (WHERE status = 'lunas')                                                             AS paid_installments,
    MIN(due_date) FILTER (WHERE status <> 'lunas')                                                       AS next_due_date,
    MIN(due_date) FILTER (WHERE status = 'belum' AND due_date < CURRENT_DATE)                            AS overdue_since,
    COALESCE(SUM(total_amount) FILTER (WHERE status = 'belum' AND due_date < CURRENT_DATE), 0)           AS arrears_amount
  FROM installments
  GROUP BY loan_id
)
SELECT
  l.*,
  m.name           AS member_name,
  m.member_number,
  m.region_id,
  r.name           AS region_name,
  COALESCE(g.remaining_balance, 0)  AS remaining_balance,
  COALESCE(g.paid_installments, 0)  AS paid_installments,
  g.next_due_date,
  COALESCE(g.arrears_amount, 0)     AS arrears_amount,
  COALESCE(CURRENT_DATE - g.overdue_since, 0) AS days_overdue,
  CASE
    WHEN g.overdue_since IS NULL THEN 'Lancar'
    WHEN CURRENT_DATE - g.overdue_since <= 30 THEN 'DPK'
    WHEN CURRENT_DATE - g.overdue_since <= 60 THEN 'Kurang Lancar'
    WHEN CURRENT_DATE - g.overdue_since <= 90 THEN 'Diragukan'
    ELSE 'Macet'
  END AS collectibility
FROM loans l
JOIN members m ON m.id = l.member_id
JOIN regions r ON r.id = m.region_id
LEFT JOIN agg g ON g.loan_id = l.id
WHERE l.deleted_at IS NULL AND m.deleted_at IS NULL;
