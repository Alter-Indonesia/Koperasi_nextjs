-- db_koperasi · nama tabel & kolom diganti ke bahasa Inggris (data & nilai enum tetap)
-- Dijalankan sekali (dicatat di _migrations oleh scripts/db.mjs).

DROP VIEW IF EXISTS v_pinjaman;

-- ---------- tabel ----------
ALTER TABLE wilayah           RENAME TO regions;
ALTER TABLE pengguna          RENAME TO users;
ALTER TABLE anggota           RENAME TO members;
ALTER TABLE pinjaman          RENAME TO loans;
ALTER TABLE angsuran          RENAME TO installments;
ALTER TABLE pembayaran        RENAME TO payments;
ALTER TABLE penugasan         RENAME TO assignments;
ALTER TABLE pengingat_saluran  RENAME TO reminder_channels;
ALTER TABLE pengingat_aturan   RENAME TO reminder_rules;
ALTER TABLE pengingat_template RENAME TO reminder_templates;
ALTER TABLE pengingat_log      RENAME TO reminder_logs;
ALTER TABLE sesi              RENAME TO sessions;

-- ---------- kolom ----------
ALTER TABLE regions RENAME COLUMN nama TO name;

ALTER TABLE users RENAME COLUMN kode           TO code;
ALTER TABLE users RENAME COLUMN nama           TO name;
ALTER TABLE users RENAME COLUMN no_hp          TO phone;
ALTER TABLE users RENAME COLUMN wilayah_id     TO region_id;
ALTER TABLE users RENAME COLUMN login_terakhir TO last_login_at;
ALTER TABLE users RENAME COLUMN gagal_login    TO failed_login_count;
ALTER TABLE users RENAME COLUMN terkunci_sampai TO locked_until;

ALTER TABLE members RENAME COLUMN no_anggota        TO member_number;
ALTER TABLE members RENAME COLUMN nama              TO name;
ALTER TABLE members RENAME COLUMN nik               TO national_id;
ALTER TABLE members RENAME COLUMN no_hp             TO phone;
ALTER TABLE members RENAME COLUMN alamat            TO address;
ALTER TABLE members RENAME COLUMN wilayah_id        TO region_id;
ALTER TABLE members RENAME COLUMN bergabung         TO joined_on;
ALTER TABLE members RENAME COLUMN simpanan_pokok    TO principal_savings;
ALTER TABLE members RENAME COLUMN simpanan_wajib    TO mandatory_savings;
ALTER TABLE members RENAME COLUMN simpanan_sukarela TO voluntary_savings;
ALTER TABLE members RENAME COLUMN pengguna_id       TO user_id;
ALTER TABLE members RENAME COLUMN img_ktp           TO id_card_image;

ALTER TABLE loans RENAME COLUMN no_pinjaman   TO loan_number;
ALTER TABLE loans RENAME COLUMN anggota_id    TO member_id;
ALTER TABLE loans RENAME COLUMN plafon        TO principal_amount;
ALTER TABLE loans RENAME COLUMN tenor         TO tenor_months;
ALTER TABLE loans RENAME COLUMN jasa_persen   TO interest_rate_percent;
ALTER TABLE loans RENAME COLUMN angsuran      TO installment_amount;
ALTER TABLE loans RENAME COLUMN tujuan        TO purpose;
ALTER TABLE loans RENAME COLUMN jaminan       TO collateral;
ALTER TABLE loans RENAME COLUMN tanggal_cair  TO disbursed_on;
ALTER TABLE loans RENAME COLUMN diajukan_oleh TO submitted_by;

ALTER TABLE installments RENAME COLUMN pinjaman_id TO loan_id;
ALTER TABLE installments RENAME COLUMN ke          TO sequence;
ALTER TABLE installments RENAME COLUMN jatuh_tempo TO due_date;
ALTER TABLE installments RENAME COLUMN pokok       TO principal_amount;
ALTER TABLE installments RENAME COLUMN jasa        TO interest_amount;
ALTER TABLE installments RENAME COLUMN total       TO total_amount;

ALTER TABLE payments RENAME COLUMN angsuran_id        TO installment_id;
ALTER TABLE payments RENAME COLUMN nominal            TO amount;
ALTER TABLE payments RENAME COLUMN denda              TO penalty_amount;
ALTER TABLE payments RENAME COLUMN metode             TO method;
ALTER TABLE payments RENAME COLUMN keterangan_metode  TO method_note;
ALTER TABLE payments RENAME COLUMN petugas_id         TO collector_id;
ALTER TABLE payments RENAME COLUMN dibayar_pada       TO paid_at;
ALTER TABLE payments RENAME COLUMN foto_bukti         TO proof_image;
ALTER TABLE payments RENAME COLUMN lokasi             TO location_name;
ALTER TABLE payments RENAME COLUMN catatan            TO notes;
ALTER TABLE payments RENAME COLUMN catatan_verifikasi TO verification_notes;
ALTER TABLE payments RENAME COLUMN diverifikasi_oleh  TO verified_by;
ALTER TABLE payments RENAME COLUMN diverifikasi_pada  TO verified_at;

ALTER TABLE assignments RENAME COLUMN angsuran_id TO installment_id;
ALTER TABLE assignments RENAME COLUMN petugas_id  TO collector_id;
ALTER TABLE assignments RENAME COLUMN tanggal     TO assigned_on;

ALTER TABLE reminder_channels RENAME COLUMN kode      TO code;
ALTER TABLE reminder_channels RENAME COLUMN nama      TO name;
ALTER TABLE reminder_channels RENAME COLUMN deskripsi TO description;
ALTER TABLE reminder_channels RENAME COLUMN aktif     TO is_active;
ALTER TABLE reminder_channels RENAME COLUMN urutan    TO sort_order;

ALTER TABLE reminder_rules RENAME COLUMN offset_hari TO day_offset;
ALTER TABLE reminder_rules RENAME COLUMN judul       TO title;
ALTER TABLE reminder_rules RENAME COLUMN keterangan  TO description;
ALTER TABLE reminder_rules RENAME COLUMN urutan      TO sort_order;

ALTER TABLE reminder_templates RENAME COLUMN kode    TO code;
ALTER TABLE reminder_templates RENAME COLUMN saluran TO channel;
ALTER TABLE reminder_templates RENAME COLUMN isi     TO body;

ALTER TABLE reminder_logs RENAME COLUMN angsuran_id  TO installment_id;
ALTER TABLE reminder_logs RENAME COLUMN saluran      TO channel;
ALTER TABLE reminder_logs RENAME COLUMN dikirim_pada TO sent_at;
ALTER TABLE reminder_logs RENAME COLUMN keterangan   TO notes;

ALTER TABLE sessions RENAME COLUMN pengguna_id      TO user_id;
ALTER TABLE sessions RENAME COLUMN dibuat_pada      TO created_at;
ALTER TABLE sessions RENAME COLUMN terakhir_dipakai TO last_used_at;
ALTER TABLE sessions RENAME COLUMN kedaluwarsa      TO expires_at;

-- ---------- index & sequence ----------
ALTER INDEX IF EXISTS angsuran_jatuh_tempo_idx   RENAME TO installments_due_date_idx;
ALTER INDEX IF EXISTS angsuran_status_idx        RENAME TO installments_status_idx;
ALTER INDEX IF EXISTS pembayaran_status_idx      RENAME TO payments_status_idx;
ALTER INDEX IF EXISTS pengingat_log_waktu_idx    RENAME TO reminder_logs_sent_at_idx;
ALTER INDEX IF EXISTS sesi_pengguna_idx          RENAME TO sessions_user_idx;
ALTER INDEX IF EXISTS sesi_kedaluwarsa_idx       RENAME TO sessions_expires_at_idx;
ALTER INDEX IF EXISTS anggota_nik_uq             RENAME TO members_national_id_uq;
ALTER SEQUENCE IF EXISTS wilayah_id_seq          RENAME TO regions_id_seq;
ALTER SEQUENCE IF EXISTS pengguna_id_seq         RENAME TO users_id_seq;
ALTER SEQUENCE IF EXISTS anggota_id_seq          RENAME TO members_id_seq;
ALTER SEQUENCE IF EXISTS pinjaman_id_seq         RENAME TO loans_id_seq;
ALTER SEQUENCE IF EXISTS angsuran_id_seq         RENAME TO installments_id_seq;
ALTER SEQUENCE IF EXISTS pembayaran_id_seq       RENAME TO payments_id_seq;
ALTER SEQUENCE IF EXISTS penugasan_id_seq        RENAME TO assignments_id_seq;
ALTER SEQUENCE IF EXISTS pengingat_aturan_id_seq RENAME TO reminder_rules_id_seq;
ALTER SEQUENCE IF EXISTS pengingat_log_id_seq    RENAME TO reminder_logs_id_seq;

-- ---------- kunci JSON biodata / metadata ----------
CREATE FUNCTION pg_temp.rename_keys(j jsonb) RETURNS jsonb AS $$
  SELECT jsonb_object_agg(COALESCE(m.baru, e.key), e.value)
  FROM jsonb_each(j) e
  LEFT JOIN (VALUES
    ('nama', 'name'), ('tempat_lahir', 'place_of_birth'), ('tanggal_lahir', 'date_of_birth'), ('jenis_kelamin', 'gender'),
    ('golongan_darah', 'blood_type'), ('alamat', 'address'), ('kelurahan', 'village'), ('kecamatan', 'district'),
    ('agama', 'religion'), ('status_perkawinan', 'marital_status'), ('pekerjaan', 'occupation'),
    ('kewarganegaraan', 'nationality'), ('berlaku_hingga', 'valid_until'), ('nik', 'national_id'),
    ('no_hp', 'phone'), ('wilayah_id', 'region_id'), ('wilayah', 'region_name'), ('simpanan_pokok', 'principal_savings'),
    ('sumber_biodata', 'biodata_source')
  ) AS m(lama, baru) ON m.lama = e.key
$$ LANGUAGE sql;

UPDATE members SET biodata  = pg_temp.rename_keys(biodata)  WHERE biodata  IS NOT NULL AND biodata  <> '{}'::jsonb;
UPDATE members SET metadata = pg_temp.rename_keys(metadata) WHERE metadata IS NOT NULL AND metadata <> '{}'::jsonb;

-- ---------- view ----------
CREATE VIEW v_loans AS
WITH agg AS (
  SELECT
    loan_id,
    COALESCE(SUM(total_amount) FILTER (WHERE status <> 'lunas'), 0)                                       AS remaining_balance,
    COUNT(*) FILTER (WHERE status = 'lunas')                                                             AS paid_installments,
    MIN(due_date) FILTER (WHERE status <> 'lunas')                                                       AS next_due_date,
    MIN(due_date) FILTER (WHERE status = 'belum' AND due_date < CURRENT_DATE)                            AS overdue_since,
    COALESCE(SUM(total_amount) FILTER (WHERE status = 'belum' AND due_date < CURRENT_DATE), 0)           AS arrears_amount
  FROM installments
  GROUP BY loan_id
)
SELECT
  l.*,
  m.name           AS member_name,
  m.member_number,
  m.region_id,
  r.name           AS region_name,
  COALESCE(g.remaining_balance, 0)  AS remaining_balance,
  COALESCE(g.paid_installments, 0)  AS paid_installments,
  g.next_due_date,
  COALESCE(g.arrears_amount, 0)     AS arrears_amount,
  COALESCE(CURRENT_DATE - g.overdue_since, 0) AS days_overdue,
  CASE
    WHEN g.overdue_since IS NULL THEN 'Lancar'
    WHEN CURRENT_DATE - g.overdue_since <= 30 THEN 'DPK'
    WHEN CURRENT_DATE - g.overdue_since <= 60 THEN 'Kurang Lancar'
    WHEN CURRENT_DATE - g.overdue_since <= 90 THEN 'Diragukan'
    ELSE 'Macet'
  END AS collectibility
FROM loans l
JOIN members m ON m.id = l.member_id
JOIN regions r ON r.id = m.region_id
LEFT JOIN agg g ON g.loan_id = l.id
WHERE l.deleted_at IS NULL AND m.deleted_at IS NULL;
