import { z } from "zod";
import { q, one } from "@/lib/db";
import { MemberFields, BiodataSchema, buildMetadata } from "@/lib/anggota-schema";
import { body, created, currentUser, handle, HttpError, intParam, ok } from "@/lib/http";

// GET /api/v1/anggota?region_id=&q=&page=&limit=
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 9, 1, 100);
  const region = sp.get("region_id") ? intParam(sp.get("region_id"), 0, 1, 1e6) || null : null;
  const search = sp.get("q")?.trim() || null;
  const base = `
    FROM members m
    JOIN regions r ON r.id = m.region_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS active_loans, COALESCE(SUM(remaining_balance),0) AS remaining_balance, COALESCE(SUM(arrears_amount),0) AS arrears_amount
      FROM v_loans v WHERE v.member_id = m.id AND v.status = 'aktif'
    ) p ON true
    WHERE m.deleted_at IS NULL
      AND ($1::int IS NULL OR m.region_id = $1)
      AND ($2::text IS NULL OR m.name ILIKE '%' || $2 || '%' OR m.member_number ILIKE '%' || $2 || '%' OR m.national_id ILIKE '%' || $2 || '%' OR m.phone ILIKE '%' || $2 || '%')`;
  const [rows, total, stat] = await Promise.all([
    q(`SELECT m.id, m.member_number, m.name, m.national_id, m.phone, m.joined_on, m.status, r.name AS region_name,
              m.principal_savings + m.mandatory_savings + m.voluntary_savings AS total_savings,
              p.active_loans, p.remaining_balance, p.arrears_amount,
              CASE WHEN m.status = 'nonaktif' THEN 'Nonaktif'
                   WHEN p.arrears_amount > 0 THEN 'Menunggak'
                   WHEN m.joined_on >= date_trunc('month', CURRENT_DATE) THEN 'Baru'
                   ELSE 'Aktif' END AS status_label
       ${base} ORDER BY m.name LIMIT $3 OFFSET $4`, [region, search, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, [region, search]),
    one(`SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE joined_on >= date_trunc('month', CURRENT_DATE)) AS new_this_month,
                (SELECT COUNT(DISTINCT member_id) FROM v_loans WHERE status = 'aktif') AS borrowing,
                (SELECT COUNT(DISTINCT member_id) FROM v_loans WHERE status = 'aktif' AND arrears_amount > 0) AS in_arrears,
                COALESCE(SUM(principal_savings + mandatory_savings + voluntary_savings),0) AS total_savings
         FROM members WHERE deleted_at IS NULL`),
  ]);
  return ok(rows, { page, limit, total: total?.n ?? 0, stats: stat });
}, { module: "members" });

const NewMember = z.object({
  ...MemberFields,
  principal_savings: z.number().int().min(0).default(0), // isian default 100 ribu, bisa diubah admin sesuai kebijakan koperasi
  biodata: BiodataSchema.default({}), // isian dari KTP (hasil baca otomatis, sudah dikoreksi admin)
  biodata_source: MemberFields.biodata_source.default("manual"),
});

// POST /api/v1/anggota  (foto KTP diunggah terpisah ke POST /anggota/{id}/ktp)
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewMember);
  const region = await one<{ name: string }>("SELECT name FROM regions WHERE id = $1", [d.region_id]);
  if (!region) throw new HttpError(422, "Wilayah tidak ditemukan");
  if (await one("SELECT 1 FROM members WHERE national_id = $1 AND deleted_at IS NULL", [d.national_id])) throw new HttpError(409, "NIK sudah terdaftar sebagai anggota lain");
  const metadata = buildMetadata({ ...d, region_name: region.name });
  const r = await one(
    `INSERT INTO members (member_number, name, national_id, phone, address, region_id, principal_savings, biodata, metadata, created_by, updated_by)
     VALUES ('AG-' || LPAD(((SELECT COALESCE(MAX(id),0) FROM members) + 1000)::text, 4, '0'), $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $9)
     RETURNING id, member_number, name`,
    [d.name, d.national_id, d.phone, d.address, d.region_id, d.principal_savings, JSON.stringify(d.biodata), JSON.stringify(metadata), currentUser().id],
  );
  return created(r);
}, { module: "members" });
