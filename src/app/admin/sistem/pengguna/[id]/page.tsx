"use client";
import { EntityDetailPage } from "@/components/crud/EntityPages";
import { useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import { userFields, userPayload } from "../user-fields";

type User = {
  id: number; code: string | null; name: string; email: string; phone: string | null; role: string; role_name: string; region_id: number | null; region_name: string | null;
  status: "aktif" | "nonaktif"; last_login_at: string | null; created_at: string; updated_at: string; created_by_name: string | null; updated_by_name: string | null;
};

export default function PenggunaDetailPage({ params }: PageProps<"/admin/sistem/pengguna/[id]">) {
  const { user: me } = useSession();
  const roles = useApi<{ code: string; name: string }[]>("/api/v1/role");
  const regions = useApi<{ id: number; name: string }[]>("/api/v1/wilayah");
  const fields = userFields((roles.data ?? []).map((r) => ({ value: r.code, label: r.name })), (regions.data ?? []).map((r) => ({ value: String(r.id), label: r.name })));
  return (
    <EntityDetailPage<User>
      params={params}
      heading={(r) => r.name}
      subtitle={(r) => `${r.email} · ${r.role_name}${r.region_name ? ` · ${r.region_name}` : ""}`}
      formTitle="Data Pengguna"
      listHref="/admin/sistem/pengguna"
      listLabel="Pengguna"
      apiPath="/api/v1/pengguna"
      fields={fields}
      loadingExtra={!roles.data || !regions.data}
      toValues={(r) => ({ name: r.name, email: r.email, phone: r.phone ?? "", code: r.code ?? "", role: r.role, region_id: r.region_id ? String(r.region_id) : "", status: r.status, password: "" })}
      toPayload={userPayload}
      canDelete={(r) => r.id !== me?.id}
      deleteWarning={(r) => `Akun ${r.name} (${r.email}) akan dihapus dan semua sesi loginnya diputus. Data tetap tersimpan (soft delete).`}
    />
  );
}
