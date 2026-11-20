-- db_koperasi · petugas mencatat pembayaran di lapangan dan menunda tagihan (janji bayar + alasan)
--
-- payment_promises : tagihan yang ditunda petugas ke tanggal yang dijanjikan anggota, lengkap dengan alasannya.
--                    Tagihan ikut ditugaskan ulang ke petugas yang sama pada tanggal janji (assignments).
-- Hak akses        : Petugas boleh membuat (my_tasks · create) pembayaran/penundaan atas tagihan yang ditugaskan kepadanya.

CREATE TABLE IF NOT EXISTS payment_promises (
  id             serial PRIMARY KEY,
  installment_id int NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  collector_id   int NOT NULL REFERENCES users(id),
  promised_on    date NOT NULL,
  reason         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     integer REFERENCES users(id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     integer REFERENCES users(id),
  deleted_at     timestamptz,
  deleted_by     integer REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS payment_promises_installment_idx ON payment_promises (installment_id, promised_on DESC);
DROP TRIGGER IF EXISTS trg_updated_at ON payment_promises;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON payment_promises FOR EACH ROW EXECUTE FUNCTION set_updated_at();

UPDATE role_permissions SET can_create = true
WHERE module = 'my_tasks' AND role_id IN (SELECT id FROM roles WHERE code IN ('petugas', 'owner'));
