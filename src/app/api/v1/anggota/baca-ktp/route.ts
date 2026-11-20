import { handle, ok } from "@/lib/http";
import { parseKtpBanyak } from "@/lib/ktp";
import { bacaFotoKtp, bacaTeksKtp } from "@/lib/ktp-ocr";

// POST /api/v1/anggota/baca-ktp  (multipart, field `foto`) -> { national_id, biodata }
// Hanya membaca (OCR lokal dengan Tesseract), tidak menyimpan apa pun. Hasil harus diperiksa admin sebelum disimpan.
export const POST = handle(async (req: Request) => {
  const { buf } = await bacaFotoKtp(req);
  const hasil = parseKtpBanyak(await bacaTeksKtp(buf));
  return ok(hasil, { fields_read: Object.keys(hasil.biodata).length + (hasil.national_id ? 1 : 0) });
}, { module: "members", log: "ocr" });
