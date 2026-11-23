-- db_koperasi · pelunasan dipercepat oleh anggota
--
-- Anggota mengajukan pelunasan seluruh sisa pinjaman; nominal = jumlah semua angsuran yang belum lunas (snapshot saat diajukan).
-- Anggota transfer ke rekening koperasi, lalu Admin memverifikasi: semua angsuran tersisa lunas (dicatat sebagai pembayaran
-- transfer terverifikasi per angsuran) dan pinjaman berstatus 'lunas'. Satu pengajuan 'menunggu' per pinjaman.
-- Hak akses: anggota boleh membuat/membatalkan pengajuan (my_loans · create); Admin memutuskan lewat modul payments.

CREATE TABLE IF NOT EXISTS loan_payoffs (
  id                 serial PRIMARY KEY,
  loan_id            int NOT NULL REFERENCES loans(id),
  member_id          int NOT NULL REFERENCES members(id),
  amount             numeric(14, 0) NOT NULL CHECK (amount > 0),   -- jumlah sisa angsuran saat diajukan
  installments_count int NOT NULL CHECK (installments_count > 0),
  status             text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'terverifikasi', 'ditolak', 'dibatalkan')),
  requested_at       timestamptz NOT NULL DEFAULT now(),
  decided_at         timestamptz,
  decided_by         int REFERENCES users(id),
  notes              text,                                          -- alasan penolakan / catatan Admin
  proof_image        text,                                          -- bukti transfer (menyusul: unggah bukti)
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         integer REFERENCES users(id),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         integer REFERENCES users(id),
  deleted_at         timestamptz,
  deleted_by         integer REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS loan_payoffs_pending_uq ON loan_payoffs (loan_id) WHERE status = 'menunggu' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS loan_payoffs_status_idx ON loan_payoffs (status, requested_at DESC) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_updated_at ON loan_payoffs;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON loan_payoffs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- anggota boleh mengajukan / membatalkan pelunasan
UPDATE role_permissions SET can_create = true
WHERE module = 'my_loans' AND role_id IN (SELECT id FROM roles WHERE code = 'anggota');
