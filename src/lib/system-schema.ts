import { z } from "zod";
import { PASSWORD_MAX_BYTES } from "@/lib/auth";
import { ACTIONS, AREAS, MODULES } from "@/lib/permissions";

/** Skema bersama menu Sistem (pengguna & role). */
export const UserFields = {
  code: z.string().trim().max(20).optional(),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  // kosong = tanpa email (akun anggota login dengan no. HP); minimal salah satu email / no. HP wajib (dicek di endpoint)
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Format email tidak valid").max(120)]),
  phone: z.string().trim().max(20).optional(),
  role: z.string().trim().min(1, "Role wajib dipilih").max(30),
  region_id: z.number().int().positive().nullable().optional(),
  status: z.enum(["aktif", "nonaktif"]),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .refine((p) => Buffer.byteLength(p) <= PASSWORD_MAX_BYTES, "Password terlalu panjang (maks. 72 byte)"),
};

export const RoleFields = {
  code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,29}$/, "Kode 3–30 karakter: huruf kecil, angka, garis bawah; diawali huruf"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60),
  description: z.string().trim().max(200).optional(),
  area: z.enum(AREAS),
};

const MODULE_CODES: string[] = MODULES.map((m) => m.code);
export const PermissionsInput = z.object({
  permissions: z
    .record(z.string(), z.array(z.enum(ACTIONS)))
    .refine((p) => Object.keys(p).every((k) => MODULE_CODES.includes(k)), "Modul tidak dikenal"),
});
