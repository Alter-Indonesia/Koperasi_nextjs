import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp, { type Sharp } from "sharp";
import { createWorker } from "tesseract.js";
import { HttpError } from "@/lib/errors";
import { skorKtp } from "@/lib/ktp";

/** Foto KTP disimpan di folder proyek (bukan di public/): hanya bisa diambil lewat API yang wajib login. */
export const FOLDER_KTP = path.join(process.cwd(), "storage", "ktp");
const FOLDER_BAHASA = path.join(process.cwd(), "storage", "tessdata"); // ind.traineddata (tanpa gzip)

export const MAKS_BYTE_KTP = 5 * 1024 * 1024;
const JENIS: Record<string, { ext: string; cocok: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", cocok: (b) => b[0] === 0xff && b[1] === 0xd8 },
  "image/png": { ext: "png", cocok: (b) => b.subarray(1, 4).toString() === "PNG" },
  "image/webp": { ext: "webp", cocok: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};
export const MIME_KTP = Object.keys(JENIS);

/** Ambil berkas dari multipart `foto`; periksa ukuran, tipe, dan isi (magic bytes), bukan hanya ekstensi. */
export async function bacaFotoKtp(req: Request): Promise<{ buf: Buffer; ext: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Body harus multipart/form-data dengan berkas pada field 'foto'");
  }
  const f = form.get("foto");
  if (!(f instanceof File) || f.size === 0) throw new HttpError(400, "Berkas foto KTP wajib dikirim (field 'foto')");
  if (f.size > MAKS_BYTE_KTP) throw new HttpError(413, "Ukuran foto maksimal 5 MB");
  const jenis = JENIS[f.type];
  const buf = Buffer.from(await f.arrayBuffer());
  if (!jenis || !jenis.cocok(buf)) throw new HttpError(415, "Foto harus berformat JPG, PNG, atau WebP");
  return { buf, ext: jenis.ext };
}

export async function simpanFotoKtp(buf: Buffer, ext: string): Promise<string> {
  await fs.mkdir(FOLDER_KTP, { recursive: true });
  const nama = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(FOLDER_KTP, nama), buf);
  return nama;
}

export const hapusFotoKtp = (nama: string) => fs.rm(path.join(FOLDER_KTP, path.basename(nama)), { force: true });

// ---------- OCR (Tesseract lokal; foto tidak keluar dari server). Satu worker dipakai ulang, satu OCR dalam satu waktu ----------
let worker: ReturnType<typeof createWorker> | null = null;
let antrean: Promise<unknown> = Promise.resolve();

function ambilWorker() {
  worker ??= createWorker("ind", 1, { langPath: FOLDER_BAHASA, gzip: false, cacheMethod: "none" }).catch((e) => {
    worker = null;
    throw e;
  });
  return worker;
}

type Kata = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };

async function baca(gambar: Buffer, denganPosisi = false) {
  const data = (await (await ambilWorker()).recognize(gambar, {}, { blocks: denganPosisi })).data;
  const kata: Kata[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
  return { teks: data.text, kata };
}

/** Kanal merah menghilangkan latar biru bermotif KTP; lalu normalkan kontras dan pertajam. */
const merah = (p: Sharp, lebar: number) => p.resize({ width: lebar }).extractChannel("red").normalize().sharpen().png().toBuffer();
const abuTerang = (p: Sharp, lebar: number) => p.resize({ width: lebar }).grayscale().linear(1.4, -40).sharpen().png().toBuffer();

async function bacaKtp(buf: Buffer): Promise<string[]> {
  const dasar = await sharp(buf).rotate().toBuffer(); // hormati EXIF orientasi

  // 1) Orientasi: foto KTP sering terekam miring 90°/180°. Coba tiap arah dengan baca cepat, pilih yang paling banyak memuat label KTP.
  let arah = { derajat: 0, skor: -1 };
  for (const derajat of [0, 90, 270, 180]) {
    const { teks } = await baca(await merah(sharp(dasar).rotate(derajat), 1100));
    const skor = skorKtp(teks);
    if (skor > arah.skor) arah = { derajat, skor };
    if (skor >= 3) break;
  }
  const tegak = await sharp(dasar).rotate(arah.derajat).toBuffer();
  const { width = 0, height = 0 } = await sharp(tegak).metadata();

  // 2) Potong ke area teks (kartu sering hanya mengisi sebagian foto) supaya bisa diperbesar tanpa membaca latar.
  const awal = await baca(await merah(sharp(tegak), 1800), true);
  const yakin = awal.kata.filter((k) => k.confidence >= 60 && /[A-Za-z]{3,}/.test(k.text));
  let area = sharp(tegak);
  if (yakin.length >= 4) {
    const s = width / 1800, m = 40;
    const x0 = Math.max(0, Math.round((Math.min(...yakin.map((k) => k.bbox.x0)) - m) * s));
    const y0 = Math.max(0, Math.round((Math.min(...yakin.map((k) => k.bbox.y0)) - m) * s));
    const x1 = Math.min(width, Math.round((Math.max(...yakin.map((k) => k.bbox.x1)) + m) * s));
    const y1 = Math.min(height, Math.round((Math.max(...yakin.map((k) => k.bbox.y1)) + m) * s));
    if (x1 - x0 > 200 && y1 - y0 > 100) area = sharp(tegak).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });
  }

  // 3) Beberapa pengolahan/skala berbeda; hasilnya digabung per kolom oleh parser (suara terbanyak). Foto buram sangat
  //    bervariasi antar-skala, jadi satu bacaan saja tidak cukup.
  const hasil = [awal.teks];
  for (const [olah, lebar] of [[merah, 2200], [abuTerang, 2200], [merah, 1500], [abuTerang, 1500]] as const) hasil.push((await baca(await olah(area.clone(), lebar))).teks);
  return hasil;
}

export function bacaTeksKtp(buf: Buffer): Promise<string[]> {
  const hasil = antrean.then(() => bacaKtp(buf), () => bacaKtp(buf));
  antrean = hasil.catch(() => undefined);
  return hasil;
}
