import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { HttpError } from "@/lib/errors";

/** Bukti transfer disimpan di folder proyek (bukan di public/): hanya bisa diambil lewat API yang wajib login. */
export const FOLDER_BUKTI = path.join(process.cwd(), "storage", "proofs");
const MAKS_BYTE = 5 * 1024 * 1024;
const JENIS: Record<string, { ext: string; cocok: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", cocok: (b) => b[0] === 0xff && b[1] === 0xd8 },
  "image/png": { ext: "png", cocok: (b) => b.subarray(1, 4).toString() === "PNG" },
  "image/webp": { ext: "webp", cocok: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};
export const MIME_BUKTI: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Ambil berkas dari multipart `foto`; periksa ukuran, tipe, dan isi (magic bytes), bukan hanya ekstensi. */
export async function bacaBukti(req: Request): Promise<{ buf: Buffer; ext: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Body harus multipart/form-data dengan berkas pada field 'foto'");
  }
  const f = form.get("foto");
  if (!(f instanceof File) || f.size === 0) throw new HttpError(400, "Foto bukti wajib dikirim (field 'foto')");
  if (f.size > MAKS_BYTE) throw new HttpError(413, "Ukuran foto maksimal 5 MB");
  const jenis = JENIS[f.type];
  const buf = Buffer.from(await f.arrayBuffer());
  if (!jenis || !jenis.cocok(buf)) throw new HttpError(415, "Foto harus berformat JPG, PNG, atau WebP");
  return { buf, ext: jenis.ext };
}

export async function simpanBukti(buf: Buffer, ext: string): Promise<string> {
  await fs.mkdir(FOLDER_BUKTI, { recursive: true });
  const nama = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(FOLDER_BUKTI, nama), buf);
  return nama;
}

export const hapusBukti = (nama: string) => fs.rm(path.join(FOLDER_BUKTI, path.basename(nama)), { force: true });
export const bacaBerkasBukti = (nama: string) => fs.readFile(path.join(FOLDER_BUKTI, path.basename(nama))).catch(() => null);
