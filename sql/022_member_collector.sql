-- db_koperasi · petugas pemegang anggota (penugasan tetap per anggota)
--
-- members.collector_id = petugas yang memegang anggota. Petugas hanya menagih / menerima pelunasan dari anggota yang dipegangnya.
-- Diatur di Penugasan Petugas (kiri = anggota yang belum punya petugas). Penugasan harian (assignments) dibentuk otomatis dari sini
-- (ensureAssignments di src/lib/queries.ts) sehingga alur Tugas Hari Ini, bayar, dan tunda tidak berubah.
-- Data lama: petugas penugasan terakhir tiap anggota; anggota tanpa riwayat penugasan dibiarkan kosong (muncul di daftar "belum punya petugas").

ALTER TABLE members ADD COLUMN IF NOT EXISTS collector_id int REFERENCES users(id);
CREATE INDEX IF NOT EXISTS members_collector_idx ON members (collector_id) WHERE deleted_at IS NULL;

UPDATE members m SET collector_id = x.collector_id
FROM (
  SELECT DISTINCT ON (l.member_id) l.member_id, a.collector_id
  FROM assignments a
  JOIN installments i ON i.id = a.installment_id
  JOIN loans l ON l.id = i.loan_id
  JOIN users u ON u.id = a.collector_id AND u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL
  WHERE a.deleted_at IS NULL
  ORDER BY l.member_id, a.assigned_on DESC, a.id DESC
) x
WHERE m.id = x.member_id AND m.collector_id IS NULL AND m.deleted_at IS NULL;
