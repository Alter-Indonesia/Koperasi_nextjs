import { z } from "zod";

/** Skema & bantuan bersama untuk endpoint anggota (POST /anggota, PATCH /anggota/{id}). */
const text = (n: number) => z.string().trim().min(1).max(n).optional();

export const BiodataSchema = z.object({
  name: text(100), place_of_birth: text(60), date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: text(20), blood_type: text(3), address: text(200), rt_rw: text(10), village: text(60), district: text(60),
  religion: text(30), marital_status: text(30), occupation: text(60), nationality: text(30), valid_until: text(30),
});

export const MemberFields = {
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  national_id: z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit angka"),
  phone: z.string().trim().regex(/^[0-9+\- ]{8,20}$/, "Nomor HP tidak valid"),
  address: z.string().trim().min(5, "Alamat minimal 5 karakter").max(200),
  region_id: z.number().int().positive(),
  biodata_source: z.enum(["manual", "ocr"]),
};

/** `metadata` = biodata KTP + data lain anggota (dibuat server, bukan dari klien). */
export function buildMetadata(d: {
  biodata: Record<string, unknown>; national_id: string; name: string; phone: string | null; address: string | null;
  region_id: number; region_name: string; principal_savings: number; biodata_source: string;
}) {
  return {
    ...d.biodata, national_id: d.national_id, name: d.name, phone: d.phone, address: d.address, region_id: d.region_id,
    region_name: d.region_name, principal_savings: d.principal_savings, biodata_source: d.biodata_source,
  };
}
