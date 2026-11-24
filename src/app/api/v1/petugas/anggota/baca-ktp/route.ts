import { handle, ok } from "@/lib/http";
import { parseKtpBanyak } from "@/lib/ktp";
import { bacaFotoKtp, bacaTeksKtp } from "@/lib/ktp-ocr";

// POST /api/v1/petugas/anggota/baca-ktp (multipart, field `foto`) -> { national_id, biodata }. Hanya membaca (OCR lokal), tidak menyimpan.
export const POST = handle(async (req: Request) => {
  const { buf } = await bacaFotoKtp(req);
  const hasil = parseKtpBanyak(await bacaTeksKtp(buf));
  return ok(hasil, { fields_read: Object.keys(hasil.biodata).length + (hasil.national_id ? 1 : 0) });
}, { module: "my_tasks", action: "create", log: "ocr" });
