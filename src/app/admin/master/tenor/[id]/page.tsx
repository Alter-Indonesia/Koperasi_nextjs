"use client";
import { EntityDetailPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";

type Tenor = { id: number; months: number; label: string | null; is_active: boolean; sort_order: number; loan_count: number; created_at: string; updated_at: string; created_by_name: string | null; updated_by_name: string | null };
const fields: FieldDef[] = [
  { key: "months", label: "Lama pinjaman (bulan)", type: "number", required: true, min: 1, max: 60 },
  { key: "label", label: "Label (opsional)", type: "text" },
  { key: "sort_order", label: "Urutan tampil", type: "number", min: 0, max: 999 },
  { key: "is_active", label: "Aktif", type: "toggle", help: "Tenor nonaktif tidak muncul di form pinjaman baru." },
];

export default function TenorDetailPage({ params }: PageProps<"/admin/master/tenor/[id]">) {
  return (
    <EntityDetailPage<Tenor>
      params={params}
      heading={(r) => `${r.months} bulan`}
      subtitle={(r) => `${r.loan_count} pinjaman memakai tenor ini`}
      formTitle="Data Tenor"
      listHref="/admin/master/tenor"
      listLabel="Tenor"
      apiPath="/api/v1/tenor"
      fields={fields}
      toValues={(r) => ({ months: String(r.months), label: r.label ?? "", sort_order: String(r.sort_order), is_active: r.is_active })}
      toPayload={(v) => ({ months: Number(v.months), label: String(v.label).trim(), sort_order: Number(v.sort_order || 0), is_active: !!v.is_active })}
      deleteWarning={(r) => `Tenor ${r.months} bulan akan dihapus dari pilihan. Pinjaman yang sudah ada tidak terpengaruh.`}
    />
  );
}
