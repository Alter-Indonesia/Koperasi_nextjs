import type { FieldDef, Values } from "@/components/crud/EntityForm";

export type Option = { value: string; label: string };

/** Kolom form pengguna (dipakai halaman tambah & detail). Opsi role & wilayah dibaca dari API. */
export const userFields = (roles: Option[], regions: Option[]): FieldDef[] => [
  { key: "name", label: "Nama lengkap", type: "text", required: true, placeholder: "Siti Aminah" },
  { key: "email", label: "Email (untuk login)", type: "email", placeholder: "nama@koperasiku.id", help: "Boleh kosong bila pengguna login dengan no. HP (isi salah satu)." },
  { key: "phone", label: "No. HP (untuk login)", type: "text", placeholder: "0812-xxxx-xxxx" },
  { key: "code", label: "Kode pengguna", type: "text", placeholder: "Kosongkan untuk otomatis", help: "Contoh: PTG-007. Kosong = dibuat otomatis." },
  { key: "role", label: "Role", type: "select", required: true, options: roles },
  { key: "region_id", label: "Wilayah", type: "select", options: regions, help: "Wajib diisi untuk petugas lapangan." },
  { key: "status", label: "Status", type: "select", required: true, options: [{ value: "aktif", label: "Aktif" }, { value: "nonaktif", label: "Nonaktif" }] },
  {
    key: "password", label: "Password", type: "password", only: ["baru", "edit"], required: ["baru"], placeholder: "Minimal 8 karakter",
    help: "Saat mengubah: kosongkan bila password tidak diganti. Mengganti password memutus semua sesi login pengguna ini.",
  },
];

export const userInitial: Values = { name: "", email: "", phone: "", code: "", role: "", region_id: "", status: "aktif", password: "" };

/** Password kosong tidak dikirim; wilayah kosong → null. */
export function userPayload(v: Values) {
  const p: Record<string, unknown> = {
    name: String(v.name).trim(), email: String(v.email).trim(), phone: String(v.phone).trim(), code: String(v.code).trim(),
    role: String(v.role), region_id: v.region_id ? Number(v.region_id) : null, status: String(v.status),
  };
  if (String(v.password)) p.password = String(v.password);
  return p;
}
