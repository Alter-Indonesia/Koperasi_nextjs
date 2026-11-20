"use client";
import { EntityNewPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";

const fields: FieldDef[] = [{ key: "name", label: "Nama wilayah", type: "text", required: true, placeholder: "Cibeunying", wide: true }];

export default function WilayahBaruPage() {
  return (
    <EntityNewPage
      heading="Wilayah Baru"
      subtitle="Wilayah layanan untuk anggota dan petugas lapangan."
      formTitle="Data Wilayah"
      listHref="/admin/master/wilayah"
      listLabel="Wilayah"
      apiPath="/api/v1/wilayah"
      fields={fields}
      initial={{ name: "" }}
      toPayload={(v) => ({ name: String(v.name).trim() })}
    />
  );
}
