-- db_koperasi · tenor bulanan & harian, jasa per tenor, biaya admin pinjaman

-- tenors: lama + satuan (bulan|hari) + jasa (% flat per satuan, bisa diatur per tenor)
ALTER TABLE tenors RENAME COLUMN months TO duration;
ALTER TABLE tenors DROP CONSTRAINT IF EXISTS tenors_months_check;
ALTER TABLE tenors ADD CONSTRAINT tenors_duration_check CHECK (duration > 0 AND duration <= 365);
ALTER TABLE tenors ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'bulan' CHECK (unit IN ('bulan', 'hari'));
ALTER TABLE tenors ADD COLUMN IF NOT EXISTS interest_rate_percent numeric(6,3) NOT NULL DEFAULT 1.5 CHECK (interest_rate_percent >= 0 AND interest_rate_percent <= 100);
DROP INDEX IF EXISTS tenors_months_uq;
CREATE UNIQUE INDEX IF NOT EXISTS tenors_unit_duration_uq ON tenors (unit, duration) WHERE deleted_at IS NULL;

-- loans: lama + satuan tenor, biaya admin (dipotong dari dana cair)
ALTER TABLE loans RENAME COLUMN tenor_months TO tenor_duration;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS tenor_unit text NOT NULL DEFAULT 'bulan' CHECK (tenor_unit IN ('bulan', 'hari'));
ALTER TABLE loans ADD COLUMN IF NOT EXISTS admin_fee numeric(14,0) NOT NULL DEFAULT 0 CHECK (admin_fee >= 0);

-- view dibuat ulang agar memuat kolom baru (l.* diperluas saat view dibuat)
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
