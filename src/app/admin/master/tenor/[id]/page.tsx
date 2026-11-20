"use client";
import { EntityDetailPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";
import { tenorLabel } from "@/lib/format";
import { withFreshState } from "@/components/layout/FreshState";

type Tenor = { id: number; duration: number; unit: "bulan" | "hari"; interest_rate_percent: number; label: string | null; is_active: boolean; sort_order: number; loan_count: number; created_at: string; updated_at: string; created_by_name: string | null; updated_by_name: string | null };
const fields: FieldDef[] = [
  { key: "unit", label: "Satuan", type: "select", required: true, options: [{ value: "bulan", label: "Bulanan" }, { value: "hari", label: "Harian" }], help: "Bulanan: angsuran tiap bulan. Harian: angsuran tiap hari." },
  { key: "duration", label: "Lama tenor", type: "number", required: true, min: 1, max: 365, placeholder: "12", help: "Jumlah bulan (maks. 60) atau hari (maks. 365), sesuai satuan." },
  { key: "interest_rate_percent", label: "Jasa (% flat, opsional)", type: "number", min: 0, max: 100, step: "any", placeholder: "0", help: "Persen dari plafon per angsuran (per bulan untuk tenor bulanan, per hari untuk harian). Kosongkan = tanpa jasa." },
  { key: "label", label: "Label (opsional)", type: "text", placeholder: "12 bulan" },
  { key: "sort_order", label: "Urutan tampil", type: "number", min: 0, max: 999 },
  { key: "is_active", label: "Status", type: "toggle", toggleText: ["Aktif", "Nonaktif"], help: "Tenor nonaktif tidak muncul di form pinjaman baru." },
];

function TenorDetailPage({ params }: PageProps<"/admin/master/tenor/[id]">) {
  return (
    <EntityDetailPage<Tenor>
      params={params}
      module="tenors"
      heading={(r) => tenorLabel(r.duration, r.unit)}
      subtitle={(r) => `Jasa ${r.interest_rate_percent}% per ${r.unit === "hari" ? "hari" : "bulan"} · ${r.loan_count} pinjaman memakai tenor ini`}
      formTitle="Data Tenor"
      listHref="/admin/master/tenor"
      listLabel="Tenor"
      apiPath="/api/v1/tenor"
      fields={fields}
      toValues={(r) => ({ unit: r.unit, duration: String(r.duration), interest_rate_percent: String(r.interest_rate_percent), label: r.label ?? "", sort_order: String(r.sort_order), is_active: r.is_active })}
      toPayload={(v) => ({ unit: String(v.unit), duration: Number(v.duration), interest_rate_percent: Number(v.interest_rate_percent || 0), label: String(v.label).trim(), sort_order: Number(v.sort_order || 0), is_active: !!v.is_active })}
      deleteWarning={(r) => `Tenor ${tenorLabel(r.duration, r.unit)} akan dihapus dari pilihan. Pinjaman yang sudah ada tidak terpengaruh.`}
    />
  );
}

export default withFreshState(TenorDetailPage, { module: "tenors" });
