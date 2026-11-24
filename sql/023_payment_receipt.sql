-- db_koperasi · kwitansi ber-QR untuk pembayaran tunai angsuran yang dicatat petugas
-- payments.receipt_code = kode bukti (isi QR): BYR-000123-AB12CD. Hanya pembayaran tunai oleh petugas; dicari Admin di Verifikasi Bayar.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_code text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_receipt_uq ON payments (receipt_code) WHERE receipt_code IS NOT NULL;
