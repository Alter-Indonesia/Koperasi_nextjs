-- db_koperasi · persetujuan pinjaman oleh Owner (pinjaman > Rp 20 jt berstatus "pengajuan")

ALTER TABLE loans ADD COLUMN IF NOT EXISTS decided_by     integer REFERENCES users(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS decided_at     timestamptz;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS decision_notes text;

-- modul hak akses baru: loan_approvals (Owner: lihat + putuskan; Admin: hanya lihat)
INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete)
SELECT r.id, 'loan_approvals', true, false, (r.code = 'owner'), false
FROM roles r WHERE r.code IN ('owner', 'admin')
ON CONFLICT DO NOTHING;
