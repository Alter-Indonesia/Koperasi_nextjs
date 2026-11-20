import { q, one } from "@/lib/db";
import { dateParam, handle, ok } from "@/lib/http";

// GET /api/v1/jatuh-tempo?date=YYYY-MM-DD&status=all|unpaid|overdue&q=&bucket=overdue|today|tomorrow|h3
// Daftar angsuran yang jatuh tempo pada tanggal tsb + tunggakan sebelumnya, dengan ringkasan mingguan.
//  q      : cari nama anggota, no. pinjaman, atau nama petugas
//  bucket : daftar angsuran di balik satu kartu ringkasan (mengabaikan status); jumlahnya sama dengan summary.*_count
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const date = dateParam(sp.get("date"));
  const status = ["unpaid", "overdue"].includes(sp.get("status") ?? "") ? sp.get("status") : "all";
  const bucket = ["overdue", "today", "tomorrow", "h3"].find((b) => b === sp.get("bucket")) ?? null;
  const search = sp.get("q")?.trim() || null;
  const [day, week, summary, rows] = await Promise.all([
    one<{ d: string }>("SELECT COALESCE($1::date, CURRENT_DATE)::text AS d", [date]),
    q(`WITH h AS (SELECT COALESCE($1::date, CURRENT_DATE) AS d),
            w AS (SELECT generate_series(date_trunc('week', (SELECT d FROM h))::date, date_trunc('week', (SELECT d FROM h))::date + 6, '1 day')::date AS day)
       SELECT w.day::text AS date,
              (SELECT COUNT(*) FROM installments i JOIN loans l ON l.id = i.loan_id WHERE l.status = 'aktif' AND l.deleted_at IS NULL AND i.due_date = w.day) AS count
       FROM w ORDER BY w.day`, [date]),
    one(`WITH h AS (SELECT COALESCE($1::date, CURRENT_DATE) AS d)
         SELECT
           COUNT(*) FILTER (WHERE i.status = 'belum' AND i.due_date < h.d) AS overdue_count,
           COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'belum' AND i.due_date < h.d),0) AS overdue_amount,
           COUNT(*) FILTER (WHERE i.due_date = h.d) AS today_count,
           COALESCE(SUM(i.total_amount) FILTER (WHERE i.due_date = h.d),0) AS today_amount,
           COUNT(*) FILTER (WHERE i.due_date = h.d + 1) AS tomorrow_count,
           COALESCE(SUM(i.total_amount) FILTER (WHERE i.due_date = h.d + 1),0) AS tomorrow_amount,
           COUNT(*) FILTER (WHERE i.due_date = h.d + 3) AS h3_count,
           COALESCE(SUM(i.total_amount) FILTER (WHERE i.due_date = h.d + 3),0) AS h3_amount
         FROM installments i JOIN loans l ON l.id = i.loan_id, h
         WHERE l.status = 'aktif' AND l.deleted_at IS NULL`, [date]),
    q(`WITH h AS (SELECT COALESCE($1::date, CURRENT_DATE) AS d)
       SELECT * FROM (
       SELECT i.id, i.loan_id, i.sequence, i.due_date, i.total_amount, i.status, l.tenor_duration, l.tenor_unit, l.loan_number,
              m.name AS member_name, r.name AS region_name,
              COALESCE(ac.name, rc.name) AS collector_name,
              GREATEST(0, (SELECT d FROM h) - i.due_date) AS days_overdue,
              lg.channel AS reminder_channel, lg.status AS reminder_status
       FROM installments i
       JOIN loans l ON l.id = i.loan_id AND l.status = 'aktif' AND l.deleted_at IS NULL
       JOIN members m ON m.id = l.member_id
       JOIN regions r ON r.id = m.region_id
       LEFT JOIN LATERAL (SELECT u.name FROM assignments t JOIN users u ON u.id = t.collector_id WHERE t.installment_id = i.id ORDER BY t.assigned_on DESC LIMIT 1) ac ON true
       LEFT JOIN LATERAL (SELECT u.name FROM users u WHERE u.role = 'petugas' AND u.region_id = m.region_id LIMIT 1) rc ON true
       LEFT JOIN LATERAL (SELECT g.channel, g.status FROM reminder_logs g WHERE g.installment_id = i.id ORDER BY g.sent_at DESC LIMIT 1) lg ON true
       WHERE CASE $3::text
         WHEN 'overdue' THEN i.status = 'belum' AND i.due_date < (SELECT d FROM h)
         WHEN 'today' THEN i.due_date = (SELECT d FROM h)
         WHEN 'tomorrow' THEN i.due_date = (SELECT d FROM h) + 1
         WHEN 'h3' THEN i.due_date = (SELECT d FROM h) + 3
         ELSE (i.due_date = (SELECT d FROM h) OR (i.status = 'belum' AND i.due_date < (SELECT d FROM h)))
              AND ($2 = 'all'
                   OR ($2 = 'unpaid' AND i.status = 'belum' AND i.due_date = (SELECT d FROM h))
                   OR ($2 = 'overdue' AND i.status = 'belum' AND i.due_date < (SELECT d FROM h)))
       END
       ) x
       WHERE ($4::text IS NULL OR x.member_name ILIKE '%' || $4 || '%' OR x.loan_number ILIKE '%' || $4 || '%' OR x.collector_name ILIKE '%' || $4 || '%')
       ORDER BY (x.status <> 'belum'), x.due_date DESC, x.member_name
       LIMIT 200`, [date, status, bucket, search]),
  ]);
  return ok(rows, { date: day?.d, week, summary, status });
}, { module: "due_dates" });
