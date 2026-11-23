import { z } from "zod";
import { q, one, tx } from "@/lib/db";
import { MemberFields, BiodataSchema, buildMetadata } from "@/lib/anggota-schema";
import { createLoan, LoanFields } from "@/lib/loan-create";
import { syncMemberAccount } from "@/lib/member-account";
import { body, created, currentUser, handle, HttpError, intParam, ok } from "@/lib/http";

// GET /api/v1/petugas/anggota?status=berjalan|lunas&q=&page=&limit= — anggota yang dipegang petugas yang login (members.collector_id).
//  lunas = pernah berpinjaman dan semua pinjamannya sudah lunas; berjalan = selain itu (pinjaman aktif/pengajuan, atau belum punya pinjaman).
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 20, 1, 100);
  const search = sp.get("q")?.trim() || null;
  const lunas = sp.get("status") === "lunas";
  const me = currentUser();
  const base = `FROM (
      SELECT m.id, m.member_number, m.name, m.phone, m.address, m.status, r.name AS region_name,
             COUNT(l.id) FILTER (WHERE l.status = 'aktif')::int AS active_loans,
             COUNT(l.id) FILTER (WHERE l.status = 'lunas')::int AS paid_loans,
             COUNT(l.id) FILTER (WHERE l.status IN ('aktif', 'pengajuan'))::int AS open_loans,
             COALESCE(SUM(l.arrears_amount) FILTER (WHERE l.status = 'aktif'), 0) AS arrears_amount
      FROM members m JOIN regions r ON r.id = m.region_id LEFT JOIN v_loans l ON l.member_id = m.id
      WHERE m.collector_id = $1 AND m.deleted_at IS NULL
        AND ($2::text IS NULL OR m.name ILIKE '%' || $2 || '%' OR m.member_number ILIKE '%' || $2 || '%' OR m.national_id ILIKE '%' || $2 || '%' OR m.phone ILIKE '%' || $2 || '%')
      GROUP BY m.id, r.name
    ) t WHERE (t.paid_loans > 0 AND t.open_loans = 0) = $3::boolean`;
  const [rows, total] = await Promise.all([
    q(`SELECT id, member_number, name, phone, address, status, region_name, active_loans, paid_loans, arrears_amount ${base} ORDER BY name LIMIT $4 OFFSET $5`, [me.id, search, lunas, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, [me.id, search, lunas]),
  ]);
  return ok(rows, { page, limit, total: total?.n ?? 0 });
}, { module: "my_tasks" });

const NewMember = z.object({
  ...MemberFields,
  biodata: BiodataSchema.default({}),
  biodata_source: MemberFields.biodata_source.default("manual"),
  allow_partial_payment: MemberFields.allow_partial_payment.default(null),
  loan: LoanFields.optional(), // pengajuan pinjaman (opsional) untuk anggota baru ini
});

// POST /api/v1/petugas/anggota — petugas menambah anggota (otomatis dipegang petugas ini) beserta pinjamannya (opsional).
// Pinjaman langsung aktif; di atas batas persetujuan (loan_approval_limit) berstatus `pengajuan` untuk Owner. Foto KTP diunggah terpisah.
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewMember);
  const region = await one<{ name: string }>("SELECT name FROM regions WHERE id = $1 AND deleted_at IS NULL", [d.region_id]);
  if (!region) throw new HttpError(422, "Wilayah tidak ditemukan");
  if (await one("SELECT 1 FROM members WHERE national_id = $1 AND deleted_at IS NULL", [d.national_id])) throw new HttpError(409, "NIK sudah terdaftar sebagai anggota lain");
  const metadata = buildMetadata({ ...d, region_name: region.name, principal_savings: 0 });
  const me = currentUser();
  const r = await tx(async (c) => {
    const m = (await c.query(
      `INSERT INTO members (member_number, name, national_id, phone, address, region_id, principal_savings, biodata, metadata, allow_partial_payment, collector_id, created_by, updated_by)
       VALUES ('AG-' || LPAD(((SELECT COALESCE(MAX(id),0) FROM members) + 1000)::text, 4, '0'), $1, $2, $3, $4, $5, 0, $6::jsonb, $7::jsonb, $8, $9, $9, $9)
       RETURNING id, member_number, name`,
      [d.name, d.national_id, d.phone, d.address, d.region_id, JSON.stringify(d.biodata), JSON.stringify(metadata), d.allow_partial_payment, me.id],
    )).rows[0];
    await syncMemberAccount(c, m.id, me.id);
    const loan = d.loan ? await createLoan(c, m.id, d.loan, { role: me.role, userId: me.id, enforcePlafon: false }) : null;
    return { ...m, loan };
  });
  return created(r);
}, { module: "my_tasks", action: "create", log: "create_member" });
