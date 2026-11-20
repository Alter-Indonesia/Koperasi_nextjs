import fs from "node:fs/promises";
import path from "node:path";
import { one, q } from "@/lib/db";
import { currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { bacaFotoKtp, FOLDER_KTP, hapusFotoKtp, simpanFotoKtp } from "@/lib/ktp-ocr";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// GET /api/v1/anggota/{id}/ktp -> berkas foto KTP (wajib login; tidak ada URL publik, karena data pribadi)
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/anggota/[id]/ktp">) => {
  const id = idParam((await ctx.params).id);
  const a = await one<{ id_card_image: string | null }>("SELECT id_card_image FROM members WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!a) throw new HttpError(404, "Anggota tidak ditemukan");
  if (!a.id_card_image) throw new HttpError(404, "Foto KTP belum diunggah");
  const file = await fs.readFile(path.join(FOLDER_KTP, path.basename(a.id_card_image))).catch(() => null);
  if (!file) throw new HttpError(404, "Berkas foto KTP tidak ditemukan");
  return new Response(new Uint8Array(file), {
    headers: { "content-type": MIME[path.extname(a.id_card_image).slice(1)] ?? "application/octet-stream", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}, { module: "members" });

// POST /api/v1/anggota/{id}/ktp  (multipart, field `foto`) -> simpan/ganti foto KTP anggota
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/anggota/[id]/ktp">) => {
  const id = idParam((await ctx.params).id);
  const lama = await one<{ id_card_image: string | null }>("SELECT id_card_image FROM members WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!lama) throw new HttpError(404, "Anggota tidak ditemukan");
  const { buf, ext } = await bacaFotoKtp(req);
  const nama = await simpanFotoKtp(buf, ext);
  await q("UPDATE members SET id_card_image = $2, updated_by = $3 WHERE id = $1", [id, nama, currentUser().id]);
  if (lama.id_card_image) await hapusFotoKtp(lama.id_card_image);
  return ok({ id_card_image: nama });
}, { module: "members", action: "update", log: "upload" });
