-- db_koperasi · batas persetujuan Owner menjadi pengaturan (sebelumnya tertulis di kode: Rp 20 jt)

INSERT INTO settings (key, group_name, label, description, value_type, value, config, sort_order)
SELECT 'loan_approval_limit', 'Pinjaman', 'Batas persetujuan Owner',
       'Pinjaman dengan jumlah di atas nilai ini berstatus pengajuan dan menunggu persetujuan Owner; sampai nilai ini langsung aktif. Berlaku untuk pinjaman baru.',
       'number', '20000000'::jsonb,
       '{"min": 0, "max": 500000000, "step": 100000, "prefix": "Rp"}'::jsonb, 4
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loan_approval_limit');
