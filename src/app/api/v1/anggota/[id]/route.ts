import { z } from "zod";
import { one, q, tx } from "@/lib/db";
import { BiodataSchema, MemberFields, buildMetadata } from "@/lib/anggota-schema";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";

type Route = RouteContext<"/api/v1/anggota/[id]">;

// GET /api/v1/anggota/{id} — detail anggota (biodata KTP, jejak audit, pinjaman)
export const GET = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const member = await one(
    `SELECT m.id, m.member_number, m.name, m.national_id, m.phone, m.address, m.region_id, r.name AS region_name, m.joined_on, m.status,
            m.biodata, (m.id_card_image IS NOT NULL) AS has_id_card,
            m.created_at, m.updated_at, uc.name AS created_by_name, uu.name AS updated_by_name
     FROM members m
     JOIN regions r ON r.id = m.region_id
     LEFT JOIN users uc ON uc.id = m.created_by
     LEFT JOIN users uu ON uu.id = m.updated_by
     WHERE m.id = $1 AND m.deleted_at IS NULL`,
    [id],
  );
  if (!member) throw new HttpError(404, "Anggota tidak ditemukan");
  const loans = await q(
    `SELECT id, loan_number, principal_amount, tenor_months, installment_amount, status, remaining_balance, arrears_amount, collectibility
     FROM v_loans WHERE member_id = $1 ORDER BY id DESC`,
    [id],
  );
  return ok({ ...member, loans });
}, { module: "members" });

const UpdateMember = z
  .object({
    name: MemberFields.name,
    national_id: MemberFields.national_id,
    phone: MemberFields.phone,
    address: MemberFields.address,
    region_id: MemberFields.region_id,
    status: z.enum(["aktif", "nonaktif"]),
    biodata: BiodataSchema, // menggantikan seluruh biodata (kolom yang dikosongkan ikut terhapus)
    biodata_source: MemberFields.biodata_source,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Tidak ada data yang diubah");

// PATCH /api/v1/anggota/{id} — ubah data anggota (kolom yang dikirim saja). Foto KTP diganti lewat POST /anggota/{id}/ktp.
export const PATCH = handle(async (req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, UpdateMember);
  const res = await tx(async (c) => {
    const cur = (await c.query("SELECT * FROM members WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!cur) throw new HttpError(404, "Anggota tidak ditemukan");
    const nationalId = d.national_id ?? cur.national_id;
    if (d.national_id && (await c.query("SELECT 1 FROM members WHERE national_id = $1 AND id <> $2 AND deleted_at IS NULL", [d.national_id, id])).rowCount)
      throw new HttpError(409, "NIK sudah terdaftar sebagai anggota lain");
    const regionId = d.region_id ?? cur.region_id;
    const region = (await c.query("SELECT name FROM regions WHERE id = $1", [regionId])).rows[0];
    if (!region) throw new HttpError(422, "Wilayah tidak ditemukan");
    const n = {
      name: d.name ?? cur.name, national_id: nationalId, phone: d.phone ?? cur.phone, address: d.address ?? cur.address, region_id: regionId,
      status: d.status ?? cur.status, biodata: d.biodata ?? cur.biodata ?? {},
    };
    const metadata = buildMetadata({
      ...n, region_name: region.name, principal_savings: Number(cur.principal_savings), biodata_source: d.biodata_source ?? cur.metadata?.biodata_source ?? "manual",
    });
    await c.query(
      `UPDATE members SET name = $2, national_id = $3, phone = $4, address = $5, region_id = $6, status = $7, biodata = $8::jsonb, metadata = $9::jsonb, updated_by = $10
       WHERE id = $1`,
      [id, n.name, n.national_id, n.phone, n.address, n.region_id, n.status, JSON.stringify(n.biodata), JSON.stringify(metadata), currentUser().id],
    );
    return { id, member_number: cur.member_number, name: n.name };
  });
  return ok(res);
}, { module: "members" });

// DELETE /api/v1/anggota/{id} — soft delete (deleted_at/deleted_by). Ditolak (409) bila masih punya pinjaman berjalan.
export const DELETE = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const res = await tx(async (c) => {
    const cur = (await c.query("SELECT id, name, member_number FROM members WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!cur) throw new HttpError(404, "Anggota tidak ditemukan");
    const running = Number((await c.query("SELECT COUNT(*) AS n FROM loans WHERE member_id = $1 AND deleted_at IS NULL AND status IN ('pengajuan', 'aktif')", [id])).rows[0].n);
    if (running) throw new HttpError(409, `Anggota tidak bisa dihapus: masih punya ${running} pinjaman berjalan`);
    await c.query("UPDATE members SET deleted_at = now(), deleted_by = $2, updated_by = $2 WHERE id = $1", [id, currentUser().id]);
    return { id, member_number: cur.member_number, name: cur.name, deleted: true };
  });
  return ok(res);
}, { module: "members" });
