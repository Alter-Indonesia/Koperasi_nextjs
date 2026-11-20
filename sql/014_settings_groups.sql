-- db_koperasi · pengaturan pembayaran dipecah menjadi kartu per topik (grup) agar mudah dipahami
-- Urutan kartu mengikuti sort_order terkecil di tiap grup (lihat GET /pengaturan).

UPDATE settings SET group_name = 'Metode Pembayaran' WHERE key IN ('payment_cash_enabled', 'payment_transfer_enabled', 'payment_qris_enabled') AND deleted_at IS NULL;
UPDATE settings SET group_name = 'Rekening Transfer' WHERE key IN ('bank_name', 'bank_account_number', 'bank_account_name', 'transfer_unique_code') AND deleted_at IS NULL;
UPDATE settings SET group_name = 'Payment Gateway' WHERE key IN ('payment_gateway_enabled', 'payment_gateway_provider') AND deleted_at IS NULL;
UPDATE settings SET group_name = 'Bayar Sebagian' WHERE key IN ('partial_payment_enabled', 'partial_payment_min_percent') AND deleted_at IS NULL;
UPDATE settings SET group_name = 'Setoran Kas Petugas', label = 'Batas jam setor' WHERE key = 'deposit_deadline' AND deleted_at IS NULL;
UPDATE settings SET group_name = 'Setoran Kas Petugas', sort_order = 31, label = 'Target penagihan bulanan per petugas' WHERE key = 'collector_monthly_target' AND deleted_at IS NULL;
