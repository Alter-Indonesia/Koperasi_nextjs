-- db_koperasi · penerimaan setoran kas petugas oleh Admin (kasir)
--
-- Setoran berstatus 'menunggu' diputuskan Admin:
--   terima  : received_amount = uang yang benar-benar diterima. Sama dengan amount -> 'cocok'; kurang -> 'selisih'
--             dan selisihnya (returned_amount) kembali ke petugas sebagai uang tunai di tangan.
--   tolak   : status 'ditolak'; seluruh amount kembali ke petugas (returned_amount = amount).
-- Uang yang dikembalikan masuk lagi ke "uang tunai di tangan" petugas dan ikut tersetor pada setoran berikutnya
-- (carried_to_deposit_id menandai setoran yang sudah membawanya).

ALTER TABLE cash_deposits DROP CONSTRAINT IF EXISTS cash_deposits_status_check;
ALTER TABLE cash_deposits ADD CONSTRAINT cash_deposits_status_check CHECK (status IN ('menunggu', 'cocok', 'selisih', 'ditolak'));
-- setoran yang hanya membawa uang kembalian dari setoran sebelumnya tidak punya pembayaran baru
ALTER TABLE cash_deposits DROP CONSTRAINT IF EXISTS cash_deposits_payment_count_check;
ALTER TABLE cash_deposits ADD CONSTRAINT cash_deposits_payment_count_check CHECK (payment_count >= 0);

ALTER TABLE cash_deposits ADD COLUMN IF NOT EXISTS received_amount numeric(14, 0) CHECK (received_amount >= 0);
ALTER TABLE cash_deposits ADD COLUMN IF NOT EXISTS returned_amount numeric(14, 0) NOT NULL DEFAULT 0 CHECK (returned_amount >= 0);
ALTER TABLE cash_deposits ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE cash_deposits ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE cash_deposits ADD COLUMN IF NOT EXISTS carried_to_deposit_id int REFERENCES cash_deposits(id);

-- data lama: yang sudah 'cocok' diterima penuh
UPDATE cash_deposits SET received_amount = amount, decided_at = COALESCE(decided_at, deposited_on::timestamptz) WHERE status = 'cocok' AND received_amount IS NULL;
UPDATE cash_deposits SET decided_at = COALESCE(decided_at, deposited_on::timestamptz) WHERE status = 'selisih' AND decided_at IS NULL;

CREATE INDEX IF NOT EXISTS cash_deposits_status_idx ON cash_deposits (status, deposited_on DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cash_deposits_carry_idx ON cash_deposits (collector_id) WHERE returned_amount > 0 AND carried_to_deposit_id IS NULL AND deleted_at IS NULL;

-- modul hak akses baru: deposit_receipts (Admin: lihat + putuskan; Owner otomatis lewat kode)
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, 'deposit_receipts', true, false, true, false
FROM roles r WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
