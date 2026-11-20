"use client";
import { EntityNewPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";
import { withFreshState } from "@/components/layout/FreshState";

const fields: FieldDef[] = [
  { key: "unit", label: "Satuan", type: "select", required: true, options: [{ value: "bulan", label: "Bulanan" }, { value: "hari", label: "Harian" }], help: "Bulanan: angsuran tiap bulan. Harian: angsuran tiap hari." },
  { key: "duration", label: "Lama tenor", type: "number", required: true, min: 1, max: 365, placeholder: "12", help: "Jumlah bulan (maks. 60) atau hari (maks. 365), sesuai satuan." },
  { key: "interest_rate_percent", label: "Jasa (% flat, opsional)", type: "number", min: 0, max: 100, step: "any", placeholder: "0", help: "Persen dari plafon per angsuran (per bulan untuk tenor bulanan, per hari untuk harian). Kosongkan = tanpa jasa." },
  { key: "label", label: "Label (opsional)", type: "text", placeholder: "12 bulan" },
  { key: "sort_order", label: "Urutan tampil", type: "number", min: 0, max: 999 },
  { key: "is_active", label: "Status", type: "toggle", toggleText: ["Aktif", "Nonaktif"], help: "Tenor nonaktif tidak muncul di form pinjaman baru." },
];

function TenorBaruPage() {
  return (
    <EntityNewPage
      heading="Tenor Baru"
      formTitle="Data Tenor"
      listHref="/admin/master/tenor"
      listLabel="Tenor"
      apiPath="/api/v1/tenor"
      fields={fields}
      initial={{ unit: "bulan", duration: "", interest_rate_percent: "", label: "", sort_order: "0", is_active: true }}
      toPayload={(v) => ({ unit: String(v.unit), duration: Number(v.duration), interest_rate_percent: Number(v.interest_rate_percent || 0), label: String(v.label).trim(), sort_order: Number(v.sort_order || 0), is_active: !!v.is_active })}
    />
  );
}

export default withFreshState(TenorBaruPage, { module: "tenors", action: "create" });
