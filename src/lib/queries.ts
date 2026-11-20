import "server-only";

export const MAX_COLLECTOR_LOAD = 30;

/** Angsuran tertua yang belum dibayar per pinjaman, sudah/akan jatuh tempo s.d. tanggal $1 (installments = angsuran) */
export const TAGIHAN_TERBUKA = `
  SELECT DISTINCT ON (i.loan_id) i.id, i.loan_id, i.sequence, i.due_date, i.total_amount,
         m.name AS member_name, m.address AS member_address, m.region_id, r.name AS region_name, l.loan_number
  FROM installments i
  JOIN loans l ON l.id = i.loan_id AND l.status = 'aktif' AND l.deleted_at IS NULL
  JOIN members m ON m.id = l.member_id AND m.deleted_at IS NULL
  JOIN regions r ON r.id = m.region_id
  WHERE i.status = 'belum' AND i.due_date <= $1::date
  ORDER BY i.loan_id, i.due_date`;
