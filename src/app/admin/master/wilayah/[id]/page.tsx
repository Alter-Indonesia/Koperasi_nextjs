"use client";
import { EntityDetailPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";

type Region = { id: number; name: string; member_count: number; user_count: number; created_at: string; updated_at: string; created_by_name: string | null; updated_by_name: string | null };
const fields: FieldDef[] = [{ key: "name", label: "Nama wilayah", type: "text", required: true, wide: true }];

export default function WilayahDetailPage({ params }: PageProps<"/admin/master/wilayah/[id]">) {
  return (
    <EntityDetailPage<Region>
      params={params}
      heading={(r) => r.name}
      subtitle={(r) => `${r.member_count} anggota · ${r.user_count} pengguna`}
      formTitle="Data Wilayah"
      listHref="/admin/master/wilayah"
      listLabel="Wilayah"
      apiPath="/api/v1/wilayah"
      fields={fields}
      toValues={(r) => ({ name: r.name })}
      toPayload={(v) => ({ name: String(v.name).trim() })}
      deleteWarning={(r) => `Wilayah ${r.name} akan dihapus. Wilayah yang masih dipakai anggota atau pengguna tidak bisa dihapus.`}
    />
  );
}
