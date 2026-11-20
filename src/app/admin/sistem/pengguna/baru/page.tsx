"use client";
import { EntityNewPage } from "@/components/crud/EntityPages";
import { useApi } from "@/lib/api";
import { userFields, userInitial, userPayload } from "../user-fields";

export default function PenggunaBaruPage() {
  const roles = useApi<{ code: string; name: string }[]>("/api/v1/role");
  const regions = useApi<{ id: number; name: string }[]>("/api/v1/wilayah");
  const fields = userFields((roles.data ?? []).map((r) => ({ value: r.code, label: r.name })), (regions.data ?? []).map((r) => ({ value: String(r.id), label: r.name })));
  return (
    <EntityNewPage
      heading="Pengguna Baru"
      subtitle="Akun untuk masuk ke aplikasi. Hak akses mengikuti role yang dipilih."
      formTitle="Data Pengguna"
      listHref="/admin/sistem/pengguna"
      listLabel="Pengguna"
      apiPath="/api/v1/pengguna"
      fields={fields}
      initial={userInitial}
      toPayload={userPayload}
      loading={!roles.data || !regions.data}
    />
  );
}
