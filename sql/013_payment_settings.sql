-- db_koperasi · pengaturan pembayaran (metode, rekening, payment gateway, bayar sebagian) + izin bayar sebagian per anggota
--
-- Semua baris muncul otomatis di Sistem › Pengaturan (grup "Pembayaran"). Pengaturan ini baru disimpan/dikonfigurasi;
-- alur pembayaran anggota (transfer, bayar sebagian) membacanya lewat getSetting(key) saat fiturnya dibuat.
-- Kunci API payment gateway TIDAK disimpan di tabel settings: taruh di .env.local.

INSERT INTO settings (key, group_name, label, description, value_type, value, config, sort_order)
SELECT v.key, 'Pembayaran', v.label, v.description, v.value_type, v.value::jsonb, v.config::jsonb, v.sort_order
FROM (VALUES
  ('payment_cash_enabled', 'Terima pembayaran tunai', 'Anggota membayar tunai lewat petugas lapangan. Nonaktifkan bila koperasi hanya menerima transfer.', 'boolean', 'true', '{}', 10),
  ('payment_transfer_enabled', 'Terima pembayaran transfer', 'Anggota membayar dengan transfer ke rekening koperasi lalu mengunggah bukti (diverifikasi admin).', 'boolean', 'true', '{}', 11),
  ('payment_qris_enabled', 'Terima pembayaran QRIS', 'Anggota membayar lewat QRIS koperasi. Aktifkan setelah QRIS tersedia.', 'boolean', 'false', '{}', 12),
  ('bank_name', 'Nama bank tujuan transfer', 'Ditampilkan kepada anggota pada instruksi pembayaran transfer.', 'text', '"BRI"', '{"max_length": 40}', 13),
  ('bank_account_number', 'Nomor rekening koperasi', 'Nomor rekening tujuan transfer angsuran.', 'text', '"0123-01-000456-50-1"', '{"max_length": 40}', 14),
  ('bank_account_name', 'Atas nama rekening', 'Nama pemilik rekening tujuan transfer.', 'text', '"KoperasiKu"', '{"max_length": 80}', 15),
  ('transfer_unique_code', 'Kode unik transfer', 'Tambahkan 3 digit unik pada nominal transfer tiap tagihan agar pembayaran mudah dicocokkan dengan mutasi bank. Berlaku untuk transfer baru.', 'boolean', 'false', '{}', 16),
  ('payment_gateway_enabled', 'Payment gateway', 'Pencocokan pembayaran otomatis lewat penyedia pembayaran (virtual account / QRIS dinamis). Nonaktif = verifikasi manual oleh admin.', 'boolean', 'false', '{}', 17),
  ('payment_gateway_provider', 'Penyedia payment gateway', 'Dipakai bila Payment gateway aktif. Kunci API disimpan di .env.local, bukan di pengaturan ini.', 'select', '"midtrans"',
     '{"options": [{"value": "midtrans", "label": "Midtrans"}, {"value": "xendit", "label": "Xendit"}, {"value": "duitku", "label": "Duitku"}]}', 18),
  ('partial_payment_enabled', 'Izinkan bayar sebagian (semua anggota)', 'Anggota boleh membayar kurang dari angsuran; sisanya tetap menjadi tagihan. Tiap anggota bisa menyimpang dari pengaturan ini di formnya (Data Anggota › Bayar sebagian).', 'boolean', 'false', '{}', 20),
  ('partial_payment_min_percent', 'Minimal bayar sebagian', 'Pembayaran sebagian tidak boleh kurang dari persentase ini terhadap angsuran.', 'number', '25', '{"min": 1, "max": 99, "step": 1, "suffix": "%"}', 21)
) AS v(key, label, description, value_type, value, config, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = v.key AND s.deleted_at IS NULL);

-- batas jam setor kas: format JJ:MM divalidasi server (pattern); grup dipindah ke Pembayaran
UPDATE settings SET group_name = 'Pembayaran', sort_order = 30, label = 'Batas jam setor kas',
  description = 'Jam terakhir petugas menyetor uang tunai ke kasir, format JJ:MM (24 jam), mis. 17:00. Ditampilkan di halaman Setoran Kas petugas.',
  config = '{"max_length": 5, "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$", "pattern_hint": "gunakan format JJ:MM, mis. 17:00"}'::jsonb
WHERE key = 'deposit_deadline' AND deleted_at IS NULL;

-- izin bayar sebagian per anggota: NULL = ikuti pengaturan umum, true = boleh, false = tidak boleh
ALTER TABLE members ADD COLUMN IF NOT EXISTS allow_partial_payment boolean;
