import { z } from "zod";
import { q, one, tx } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, intParam, ok, ROLES } from "@/lib/http";

const KOL = ["Lancar", "DPK", "Kurang Lancar", "Diragukan", "Macet"] as const;

// GET /api/v1/pinjaman?kolektibilitas=&q=&page=&limit=
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 10, 1, 100);
  const kol = KOL.find((k) => k === sp.get("kolektibilitas")) ?? null;
  const cari = sp.get("q")?.trim() || null;
  const where = `status = 'aktif'
    AND ($1::text IS NULL OR kolektibilitas = $1)
    AND ($2::text IS NULL OR anggota_nama ILIKE '%' || $2 || '%' OR no_pinjaman ILIKE '%' || $2 || '%')`;
  const [rows, total, ringkas] = await Promise.all([
    q(`SELECT id, no_pinjaman, anggota_id, anggota_nama, no_anggota, wilayah, plafon, tenor, angsuran, jatuh_tempo_berikut,
              sisa, angsuran_lunas, hari_telat, kolektibilitas
       FROM v_pinjaman WHERE ${where}
       ORDER BY hari_telat DESC, no_pinjaman LIMIT $3 OFFSET $4`, [kol, cari, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM v_pinjaman WHERE ${where}`, [kol, cari]),
    one(`SELECT COUNT(*) AS semua, COALESCE(SUM(sisa),0) AS outstanding,
                ${KOL.map((k, i) => `COUNT(*) FILTER (WHERE kolektibilitas = '${k}') AS k${i}`).join(", ")}
         FROM v_pinjaman WHERE status = 'aktif'`),
  ]);
  const r = ringkas as Record<string, number>;
  return ok(rows, {
    page, limit, total: total?.n ?? 0,
    outstanding: r.outstanding, semua: r.semua,
    kolektibilitas: Object.fromEntries(KOL.map((k, i) => [k, r[`k${i}`]])),
  });
}, { roles: ROLES.admin });

const PinjamanBaru = z.object({
  anggota_id: z.number().int().positive(),
  plafon: z.number().int().min(500_000).max(500_000_000),
  tenor: z.number().int().min(1).max(60),
  jasa_persen: z.number().min(0).max(10).default(1.5),
  tujuan: z.string().trim().min(3).max(120),
  jaminan: z.string().trim().max(120).optional(),
  tanggal_cair: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const BATAS_OWNER = 20_000_000;

// POST /api/v1/pinjaman — pinjaman baru; di atas Rp 20 jt masuk status "pengajuan" (perlu persetujuan Owner)
export const POST = handle(async (req: Request) => {
  const d = await body(req, PinjamanBaru);
  const anggota = await one<{ id: number; status: string }>("SELECT id, status FROM anggota WHERE id = $1", [d.anggota_id]);
  if (!anggota) throw new HttpError(404, "Anggota tidak ditemukan");
  if (anggota.status !== "aktif") throw new HttpError(422, "Anggota tidak aktif");
  const pokok = Math.round(d.plafon / d.tenor);
  const jasa = Math.round((d.plafon * d.jasa_persen) / 100);
  const status = d.plafon > BATAS_OWNER ? "pengajuan" : "aktif";
  const res = await tx(async (c) => {
    const tahun = d.tanggal_cair.slice(2, 4);
    const seq = (await c.query("SELECT COUNT(*) + 1 AS n FROM pinjaman")).rows[0].n;
    const no = `PJ-${tahun}-${String(seq).padStart(4, "0")}`;
    const p = (
      await c.query(
        `INSERT INTO pinjaman (no_pinjaman, anggota_id, plafon, tenor, jasa_persen, angsuran, tujuan, jaminan, tanggal_cair, status, diajukan_oleh)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, no_pinjaman, status`,
        [no, d.anggota_id, d.plafon, d.tenor, d.jasa_persen, pokok + jasa, d.tujuan, d.jaminan ?? null, d.tanggal_cair, status, currentUser().id],
      )
    ).rows[0];
    if (status === "aktif") {
      await c.query(
        `INSERT INTO angsuran (pinjaman_id, ke, jatuh_tempo, pokok, jasa, total)
         SELECT $1, k, ($2::date + make_interval(months => k))::date, $3, $4, $3 + $4 FROM generate_series(1, $5) k`,
        [p.id, d.tanggal_cair, pokok, jasa, d.tenor],
      );
    }
    return p;
  });
  return created(res);
}, { roles: ROLES.admin });
