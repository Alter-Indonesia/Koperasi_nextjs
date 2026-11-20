import { q, one } from "@/lib/db";
import { dateParam, handle, intParam, ok } from "@/lib/http";

// GET /api/v1/laporan/penagihan?from=YYYY-MM-DD&to=YYYY-MM-DD&region_id=
// Default: awal bulan ini s.d. hari ini.
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const range = (await one<{ from: string; to: string }>(
    `SELECT COALESCE($1::date, date_trunc('month', CURRENT_DATE)::date)::text AS "from", COALESCE($2::date, CURRENT_DATE)::text AS "to"`,
    [dateParam(sp.get("from")), dateParam(sp.get("to"))],
  ))!;
  const region = sp.get("region_id") ? intParam(sp.get("region_id"), 0, 1, 1e6) || null : null;
  const P = [range.from, range.to, region];
  // angsuran yang jatuh tempo di periode (basis "ditagih")
  const BILLED = `
    FROM installments i
    JOIN loans l ON l.id = i.loan_id AND l.status IN ('aktif','lunas') AND l.deleted_at IS NULL
    JOIN members m ON m.id = l.member_id
    WHERE i.due_date BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR m.region_id = $3)`;
  const [kpi, perCollector, methods, daily, aging, followUp] = await Promise.all([
    one(`SELECT COUNT(*) AS billed_count, COALESCE(SUM(i.total_amount),0) AS billed_amount,
                COUNT(*) FILTER (WHERE i.status <> 'belum') AS paid_count,
                COALESCE(SUM(i.total_amount) FILTER (WHERE i.status <> 'belum'),0) AS collected_amount,
                COUNT(*) FILTER (WHERE i.status = 'belum' AND i.due_date < CURRENT_DATE) AS arrears_count,
                COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'belum' AND i.due_date < CURRENT_DATE),0) AS arrears_amount
         ${BILLED}`, P),
    q(`SELECT u.id, u.name, r.name AS region_name,
              COUNT(i.id) AS billed,
              COUNT(i.id) FILTER (WHERE i.status <> 'belum') AS paid,
              COALESCE(SUM(i.total_amount) FILTER (WHERE i.status <> 'belum'),0) AS collected,
              COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'belum' AND i.due_date < CURRENT_DATE),0) AS arrears
       FROM users u
       JOIN regions r ON r.id = u.region_id
       LEFT JOIN members m ON m.region_id = u.region_id AND m.deleted_at IS NULL
       LEFT JOIN loans l ON l.member_id = m.id AND l.status IN ('aktif','lunas') AND l.deleted_at IS NULL
       LEFT JOIN installments i ON i.loan_id = l.id AND i.due_date BETWEEN $1::date AND $2::date
       WHERE u.role = 'petugas' AND u.deleted_at IS NULL AND ($3::int IS NULL OR u.region_id = $3)
       GROUP BY u.id, r.name ORDER BY u.name`, P),
    q(`SELECT p.method, COUNT(*) AS count, COALESCE(SUM(p.amount + p.penalty_amount),0) AS amount
       FROM payments p JOIN installments i ON i.id = p.installment_id JOIN loans l ON l.id = i.loan_id JOIN members m ON m.id = l.member_id
       WHERE p.status <> 'ditolak' AND p.paid_at::date BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR m.region_id = $3)
       GROUP BY p.method ORDER BY amount DESC`, P),
    q(`SELECT d::date::text AS date, COALESCE(SUM(p.amount + p.penalty_amount),0) AS amount
       FROM generate_series($1::date, $2::date, '1 day') d
       LEFT JOIN payments p ON p.paid_at::date = d::date AND p.status <> 'ditolak'
         AND ($3::int IS NULL OR EXISTS (SELECT 1 FROM installments i JOIN loans l ON l.id = i.loan_id JOIN members m ON m.id = l.member_id WHERE i.id = p.installment_id AND m.region_id = $3))
       WHERE EXTRACT(ISODOW FROM d) < 7
       GROUP BY d ORDER BY d`, P),
    q(`SELECT bucket, COUNT(*) AS members, COALESCE(SUM(arrears_amount),0) AS amount FROM (
         SELECT CASE WHEN days_overdue <= 30 THEN '1–30 hari' WHEN days_overdue <= 60 THEN '31–60 hari' WHEN days_overdue <= 90 THEN '61–90 hari' ELSE '> 90 hari' END AS bucket,
                arrears_amount
         FROM v_loans WHERE status = 'aktif' AND days_overdue > 0 AND ($3::int IS NULL OR region_id = $3)) x
       WHERE $1::date IS NOT NULL AND $2::date IS NOT NULL
       GROUP BY bucket`, P),
    one(`SELECT COUNT(*) FILTER (WHERE days_overdue >= 3 AND days_overdue < 7) AS phone_call,
                COUNT(*) FILTER (WHERE days_overdue >= 7 AND days_overdue < 30) AS letter_1,
                COUNT(*) FILTER (WHERE days_overdue >= 30 AND days_overdue <= 90) AS letter_2,
                COUNT(*) FILTER (WHERE days_overdue > 90) AS escalation
         FROM v_loans WHERE status = 'aktif' AND ($1::date IS NOT NULL) AND ($2::date IS NOT NULL) AND ($3::int IS NULL OR region_id = $3)`, P),
  ]);
  const ORDER = ["1–30 hari", "31–60 hari", "61–90 hari", "> 90 hari"];
  return ok(
    {
      kpi,
      per_collector: perCollector,
      methods,
      daily,
      aging: ORDER.map((k) => aging.find((a) => a.bucket === k) ?? { bucket: k, members: 0, amount: 0 }),
      follow_up: followUp,
    },
    range,
  );
}, { module: "reports" });
