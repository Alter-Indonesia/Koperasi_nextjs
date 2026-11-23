-- db_koperasi · plafon (batas atas pinjaman) + jumlah pinjaman terpisah
--
-- loans.principal_amount  = PLAFON: batas atas pinjaman, disalin dari pengaturan loan_ceiling saat pinjaman dibuat (snapshot)
-- loans.loan_amount       = jumlah pinjaman yang diinput admin (dasar angsuran, jasa, biaya admin, persetujuan > Rp 20 jt)
-- Pinjaman lama: jumlah pinjaman = nilai principal_amount sebelumnya.

ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_amount numeric(14, 0);
UPDATE loans SET loan_amount = principal_amount WHERE loan_amount IS NULL;
ALTER TABLE loans ALTER COLUMN loan_amount SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE loans ADD CONSTRAINT loans_loan_amount_check CHECK (loan_amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- pengaturan: nilai plafon + izin Owner melebihi plafon
INSERT INTO settings (key, group_name, label, description, value_type, value, config, sort_order)
SELECT 'loan_ceiling', 'Pinjaman', 'Plafon pinjaman',
       'Batas atas jumlah pinjaman yang boleh diinput Admin. Nilainya disalin ke tiap pinjaman baru (pinjaman lama tidak berubah).',
       'number', '20000000'::jsonb,
       '{"min": 500000, "max": 500000000, "step": 100000, "prefix": "Rp"}'::jsonb, 2
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loan_ceiling');

INSERT INTO settings (key, group_name, label, description, value_type, value, config, sort_order)
SELECT 'loan_ceiling_owner_override', 'Pinjaman', 'Owner boleh melebihi plafon',
       'Aktif: Owner/superadmin boleh menginput pinjaman di atas plafon. Nonaktif: Owner juga dibatasi plafon. Admin selalu dibatasi plafon.',
       'boolean', 'true'::jsonb, '{}'::jsonb, 3
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loan_ceiling_owner_override');

-- view dibuat ulang agar l.* memuat kolom baru
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
