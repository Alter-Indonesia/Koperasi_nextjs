"use client";
import { EntityNewPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";
import { AREAS, AREA_LABEL } from "@/lib/permissions";

const fields: FieldDef[] = [
  { key: "name", label: "Nama role", type: "text", required: true, placeholder: "Supervisor Penagihan" },
  { key: "code", label: "Kode role", type: "text", required: true, placeholder: "supervisor", help: "Huruf kecil, angka, garis bawah (3–30 karakter). Tidak bisa diubah setelah dibuat." },
  { key: "area", label: "Area menu", type: "select", required: true, options: AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] })), help: "Menentukan halaman awal dan sidebar yang dipakai role ini." },
  { key: "description", label: "Deskripsi", type: "textarea", placeholder: "Opsional" },
];

export default function RoleBaruPage() {
  return (
    <EntityNewPage
      heading="Role Baru"
      subtitle="Hak akses per modul diatur setelah role dibuat."
      formTitle="Data Role"
      listHref="/admin/sistem/role"
      listLabel="Role"
      apiPath="/api/v1/role"
      fields={fields}
      initial={{ name: "", code: "", area: "admin", description: "" }}
      toPayload={(v) => ({ name: String(v.name).trim(), code: String(v.code).trim().toLowerCase(), area: String(v.area), description: String(v.description).trim() })}
    />
  );
}
