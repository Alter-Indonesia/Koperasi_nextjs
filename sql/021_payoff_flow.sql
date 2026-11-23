-- db_koperasi · alur pelunasan dipercepat: metode transfer / tunai, persetujuan Admin, bukti, dan tunai lewat petugas
--
-- Status loan_payoffs:
--   menunggu            menunggu persetujuan Admin (diajukan anggota)
--   disetujui           disetujui Admin; menunggu pembayaran (transfer: anggota unggah bukti · tunai: petugas menerima uang)
--   menunggu_verifikasi pembayaran masuk (transfer: bukti terkirim · tunai: petugas sudah menerima + kwitansi QR; menunggu setor & verifikasi)
--   terverifikasi | ditolak | dibatalkan
-- method : transfer | tunai.   source : anggota (diajukan anggota) | petugas (petugas menerima langsung, tanpa persetujuan).
-- Tunai: saat petugas menerima uang dibuat pembayaran tunai 'menunggu' per angsuran tersisa (payments.payoff_id) sehingga ikut
--        "uang tunai di tangan" petugas -> setoran kas -> verifikasi. Pembayaran itu hanya diverifikasi lewat Pelunasan.

ALTER TABLE loan_payoffs DROP CONSTRAINT IF EXISTS loan_payoffs_status_check;
ALTER TABLE loan_payoffs ADD CONSTRAINT loan_payoffs_status_check
  CHECK (status IN ('menunggu', 'disetujui', 'menunggu_verifikasi', 'terverifikasi', 'ditolak', 'dibatalkan'));

ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'transfer' CHECK (method IN ('transfer', 'tunai'));
ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'anggota' CHECK (source IN ('anggota', 'petugas'));
ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS approved_by int REFERENCES users(id);
ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS collector_id int REFERENCES users(id);   -- petugas yang menerima uang tunai
ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS received_at timestamptz;                 -- uang tunai diterima petugas
ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS receipt_code text;                       -- kode bukti (isi QR kwitansi)
ALTER TABLE loan_payoffs ADD COLUMN IF NOT EXISTS proof_uploaded_at timestamptz;

-- satu pengajuan berjalan per pinjaman (menggantikan indeks 'menunggu' saja)
DROP INDEX IF EXISTS loan_payoffs_pending_uq;
CREATE UNIQUE INDEX IF NOT EXISTS loan_payoffs_active_uq ON loan_payoffs (loan_id)
  WHERE status IN ('menunggu', 'disetujui', 'menunggu_verifikasi') AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS loan_payoffs_receipt_uq ON loan_payoffs (receipt_code) WHERE receipt_code IS NOT NULL;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payoff_id int REFERENCES loan_payoffs(id);
CREATE INDEX IF NOT EXISTS payments_payoff_idx ON payments (payoff_id) WHERE payoff_id IS NOT NULL;
