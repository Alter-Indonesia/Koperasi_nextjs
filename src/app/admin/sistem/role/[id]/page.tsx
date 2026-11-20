"use client";
import { useRef, useState } from "react";
import { EntityDetailPage } from "@/components/crud/EntityPages";
import type { FieldDef } from "@/components/crud/EntityForm";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Form";
import { api } from "@/lib/api";
import { ACTION_LABEL, ACTIONS, AREAS, AREA_LABEL, MODULES, MODULE_ACTIONS, type Action, type Area } from "@/lib/permissions";

type Matrix = Record<string, Action[]>;
type Role = {
  id: number; code: string; name: string; description: string | null; area: Area; is_system: boolean; user_count: number; permissions: Matrix;
  created_at: string; updated_at: string; created_by_name: string | null; updated_by_name: string | null;
};

const fields: FieldDef[] = [
  { key: "name", label: "Nama role", type: "text", required: true },
  { key: "code", label: "Kode role", type: "text", readOnlyOn: ["edit"], help: "Kode tidak bisa diubah." },
  { key: "area", label: "Area menu", type: "select", required: true, options: AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] })) },
  { key: "description", label: "Deskripsi", type: "textarea" },
];

/** Matriks hak akses: baris = modul, kolom = aksi. Mengubah aksi selain "Lihat" otomatis menyalakan "Lihat". */
function PermissionMatrix({ initial, editable, locked, onChange }: { initial: Matrix; editable: boolean; locked: boolean; onChange: (m: Matrix) => void }) {
  const [m, setM] = useState<Matrix>(initial);
  function toggle(module: string, action: Action, on: boolean) {
    const cur = new Set(m[module] ?? []);
    if (on) { cur.add(action); if (action !== "view") cur.add("view"); }
    else { cur.delete(action); if (action === "view") cur.clear(); }
    const next = { ...m, [module]: [...cur] as Action[] };
    setM(next);
    onChange(next);
  }
  return (
    <Card title="Hak Akses" subtitle={locked ? "Role admin dikunci agar tidak ada yang mengunci dirinya sendiri dari sistem." : editable ? "Centang aksi yang boleh dilakukan role ini." : "Aksi yang boleh dilakukan role ini."}>
      <table className="w-full text-body-sm">
        <thead>
          <tr className="text-left text-caption font-bold uppercase text-fg-muted">
            <th className="pb-2">Modul</th>
            {ACTIONS.map((a) => <th key={a} className="w-[52px] pb-2 text-center">{ACTION_LABEL[a]}</th>)}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod) => (
            <tr key={mod.code} className="border-t border-line-subtle">
              <td className="py-2 pr-2 font-medium">{mod.label}</td>
              {ACTIONS.map((a) => (
                <td key={a} className="py-2 text-center">
                  {MODULE_ACTIONS[mod.code].includes(a) ? (
                    <span className="inline-flex justify-center">
                      {editable ? (
                        <Checkbox checked={!!m[mod.code]?.includes(a)} onChange={(v) => toggle(mod.code, a, v)} label={`${ACTION_LABEL[a]} ${mod.label}`} />
                      ) : (
                        <span className={m[mod.code]?.includes(a) ? "font-bold text-fg" : "text-fg-subtle"}>{m[mod.code]?.includes(a) ? "✓" : "–"}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-fg-subtle">·</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function RoleDetailPage({ params }: PageProps<"/admin/sistem/role/[id]">) {
  const matrix = useRef<{ roleId: number; permissions: Matrix } | null>(null); // diisi hanya bila admin mengubah centang
  return (
    <EntityDetailPage<Role>
      params={params}
      heading={(r) => r.name}
      subtitle={(r) => `${r.code} · ${AREA_LABEL[r.area]} · ${r.user_count} pengguna`}
      formTitle="Data Role"
      listHref="/admin/sistem/role"
      listLabel="Role"
      apiPath="/api/v1/role"
      fields={fields}
      toValues={(r) => ({ name: r.name, code: r.code, area: r.area, description: r.description ?? "" })}
      toPayload={(v) => ({ name: String(v.name).trim(), area: String(v.area), description: String(v.description).trim() })}
      afterSave={async () => {
        if (matrix.current) await api.put(`/api/v1/role/${matrix.current.roleId}/permissions`, { permissions: matrix.current.permissions });
        matrix.current = null;
      }}
      canDelete={(r) => !r.is_system}
      deleteWarning={(r) => `Role ${r.name} akan dihapus. Role yang masih dipakai pengguna tidak bisa dihapus.`}
      extra={(r, edit) => <PermissionMatrix key={`${edit}-${r.updated_at}`} initial={r.permissions} editable={edit && r.code !== "admin"} locked={r.code === "admin"} onChange={(m) => { matrix.current = { roleId: r.id, permissions: m }; }} />}
    />
  );
}

