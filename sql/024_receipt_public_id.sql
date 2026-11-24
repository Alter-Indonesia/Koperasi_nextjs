-- db_koperasi · UUID publik untuk bukti pembayaran (kwitansi). QR kwitansi berisi tautan /bukti/{public_id} yang bisa dibuka tanpa login.
-- Baris lama otomatis mendapat UUID (default volatile dievaluasi per baris).

ALTER TABLE payments ADD COLUMN IF NOT EXISTS public_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS public_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS payments_public_id_uq ON payments (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS loan_payoffs_public_id_uq ON loan_payoffs (public_id);
