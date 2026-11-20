"use client";
import { EntityDetailPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";
import { jam, tanggal } from "@/lib/format";
import { MODULES } from "@/lib/permissions";

type Log = {
  id: number; user_name: string | null; action: string; module: string | null; entity_id: number | null; method: string | null; path: string | null;
  status_code: number | null; ip: string | null; user_agent: string | null; details: { fields?: string[]; email?: string } | null; created_at: string;
};

const fields: FieldDef[] = [
  { key: "time", label: "Waktu", type: "text" },
  { key: "user", label: "Pengguna", type: "text" },
  { key: "action", label: "Aksi", type: "text" },
  { key: "module", label: "Modul", type: "text" },
  { key: "request", label: "Permintaan", type: "text", wide: true },
  { key: "status", label: "Status HTTP", type: "text" },
  { key: "entity", label: "ID data", type: "text" },
  { key: "ip", label: "Alamat IP", type: "text" },
  { key: "fields", label: "Kolom yang dikirim", type: "text", help: "Hanya nama kolom; nilainya tidak pernah dicatat." },
  { key: "ua", label: "Perangkat (user agent)", type: "textarea" },
];

export default function LogDetailPage({ params }: PageProps<"/admin/sistem/log-aktivitas/[id]">) {
  return (
    <EntityDetailPage<Log & { updated_at?: string }>
      params={params}
      readOnly
      hideAudit
      heading={(r) => `Catatan #${r.id}`}
      subtitle={(r) => `${tanggal(r.created_at)}, ${jam(r.created_at)}`}
      formTitle="Rincian Aktivitas"
      listHref="/admin/sistem/log-aktivitas"
      listLabel="Log Aktivitas"
      apiPath="/api/v1/log-aktivitas"
      fields={fields}
      toValues={(r) => ({
        time: `${tanggal(r.created_at)}, ${jam(r.created_at)}`, user: r.user_name ?? "—", action: r.action,
        module: r.module === "auth" ? "Autentikasi" : MODULES.find((m) => m.code === r.module)?.label ?? r.module ?? "—",
        request: `${r.method ?? ""} ${r.path ?? ""}`.trim() || "—", status: String(r.status_code ?? "—"), entity: r.entity_id ? String(r.entity_id) : "—", ip: r.ip ?? "—",
        fields: r.details?.fields?.join(", ") ?? (r.details?.email ? `email: ${r.details.email}` : "—"), ua: r.user_agent ?? "—",
      })}
      toPayload={() => ({})}
    />
  );
}
