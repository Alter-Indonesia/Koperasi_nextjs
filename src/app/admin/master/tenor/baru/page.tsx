"use client";
import { EntityNewPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";

const fields: FieldDef[] = [
  { key: "months", label: "Lama pinjaman (bulan)", type: "number", required: true, min: 1, max: 60, placeholder: "12" },
  { key: "label", label: "Label (opsional)", type: "text", placeholder: "12 bulan" },
  { key: "sort_order", label: "Urutan tampil", type: "number", min: 0, max: 999 },
  { key: "is_active", label: "Aktif", type: "toggle", help: "Tenor nonaktif tidak muncul di form pinjaman baru." },
];

export default function TenorBaruPage() {
  return (
    <EntityNewPage
      heading="Tenor Baru"
      formTitle="Data Tenor"
      listHref="/admin/master/tenor"
      listLabel="Tenor"
      apiPath="/api/v1/tenor"
      fields={fields}
      initial={{ months: "", label: "", sort_order: "0", is_active: true }}
      toPayload={(v) => ({ months: Number(v.months), label: String(v.label).trim(), sort_order: Number(v.sort_order || 0), is_active: !!v.is_active })}
    />
  );
}
