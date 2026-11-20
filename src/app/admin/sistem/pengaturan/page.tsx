"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { Field, Input, Select, Toggle } from "@/components/ui/Form";
import { api, ApiError, useApi } from "@/lib/api";
import { tanggal, jam } from "@/lib/format";
import { useSession } from "@/lib/session";
import { withFreshState } from "@/components/layout/FreshState";

type Value = string | number | boolean | null;
type Setting = {
  id: number; key: string; group_name: string; label: string; description: string | null; value_type: "text" | "number" | "boolean" | "select"; value: Value;
  config: { options?: { value: string; label: string }[]; min?: number; max?: number; step?: number; prefix?: string; suffix?: string; max_length?: number };
  updated_at: string; updated_by_name: string | null;
};

/** Halaman dibentuk otomatis dari baris tabel `settings` (tipe + config); pengaturan baru muncul tanpa ubah kode. */
function PengaturanPage() {
  const { can } = useSession();
  const editable = can("settings", "update");
  const { data, error, loading, reload } = useApi<Setting[]>("/api/v1/pengaturan");
  const [edits, setEdits] = useState<Record<string, string | boolean>>({}); // nilai yang sedang diubah (number disimpan sebagai teks)
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const current = (s: Setting): string | boolean => edits[s.key] ?? (s.value_type === "boolean" ? !!s.value : s.value == null ? "" : String(s.value));
  const change = (s: Setting, v: string | boolean) => {
    setErrors((x) => ({ ...x, [s.key]: "" }));
    const original = s.value_type === "boolean" ? !!s.value : s.value == null ? "" : String(s.value);
    setEdits((x) => {
      const n = { ...x };
      if (v === original) delete n[s.key]; else n[s.key] = v;
      return n;
    });
  };
  const dirty = Object.keys(edits).length;

  async function save() {
    setErr(null);
    const e: Record<string, string> = {};
    const values: Record<string, string | number | boolean> = {};
    for (const s of data ?? []) {
      if (!(s.key in edits)) continue;
      const v = edits[s.key];
      if (s.value_type === "number") {
        const n = Number(v);
        if (v === "" || !Number.isFinite(n)) e[s.key] = `${s.label} harus berupa angka`;
        else if (s.config.min !== undefined && n < s.config.min) e[s.key] = `${s.label} minimal ${s.config.min}`;
        else if (s.config.max !== undefined && n > s.config.max) e[s.key] = `${s.label} maksimal ${s.config.max}`;
        else values[s.key] = n;
      } else values[s.key] = v;
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api.patch("/api/v1/pengaturan", { values });
      setEdits({});
      reload();
      setToast("Pengaturan tersimpan");
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  const groups = [...new Set((data ?? []).map((s) => s.group_name))];
  const last = (data ?? []).reduce<Setting | null>((a, s) => (!a || s.updated_at > a.updated_at ? s : a), null);

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Pengaturan sistem. Perubahan berlaku untuk data baru; data yang sudah ada tidak berubah." />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Skeleton className="h-[260px]" />
      ) : (
        <div className="flex max-w-[860px] flex-col gap-6">
          {groups.map((g) => (
            <Card key={g} title={g}>
              <div className="flex flex-col gap-6">
                {(data ?? []).filter((s) => s.group_name === g).map((s) => (
                  <div key={s.key}>
                    {s.value_type === "boolean" ? (
                      <div className="flex flex-col gap-2">
                        <span className="text-body-sm font-bold text-fg">{s.label}</span>
                        <div className="flex h-[52px] items-center justify-between gap-4 rounded-ctl border-[1.5px] border-line px-4">
                          <span className="text-body text-fg">{current(s) ? "Aktif" : "Nonaktif"}</span>
                          <Toggle on={!!current(s)} label={s.label} onChange={editable ? (v) => change(s, v) : undefined} />
                        </div>
                      </div>
                    ) : (
                      <Field label={s.label} error={errors[s.key]}>
                        {s.value_type === "select" ? (
                          <Select value={String(current(s))} disabled={!editable} onChange={(e) => change(s, e.target.value)}>
                            {s.config.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </Select>
                        ) : (
                          <div className="relative">
                            {s.config.prefix && <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body font-medium text-fg-muted">{s.config.prefix}</span>}
                            <Input
                              type={s.value_type === "number" ? "number" : "text"}
                              className={s.config.prefix ? "pl-12" : undefined}
                              value={String(current(s))}
                              disabled={!editable}
                              min={s.config.min}
                              max={s.config.max}
                              step={s.config.step}
                              maxLength={s.config.max_length}
                              onChange={(e) => change(s, e.target.value)}
                            />
                            {s.config.suffix && <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-body text-fg-muted">{s.config.suffix}</span>}
                          </div>
                        )}
                      </Field>
                    )}
                    {s.description && <p className="mt-2 text-small text-fg-subtle">{s.description}</p>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {data && data.length === 0 && <Card><p className="text-body-sm text-fg-muted">Belum ada pengaturan.</p></Card>}
          {data && data.length > 0 && (
            <div className="flex items-start justify-between gap-4">
              <span className="text-small text-fg-subtle">{last ? `Terakhir diubah ${tanggal(last.updated_at)} ${jam(last.updated_at)}${last.updated_by_name ? ` oleh ${last.updated_by_name}` : ""}` : ""}</span>
              {editable && (
                <div className="flex flex-col items-end gap-2">
                  {err && <span className="text-small font-medium text-warn-text">{err}</span>}
                  <Button size="lg" onClick={save} disabled={saving || !dirty}>{saving ? "Menyimpan…" : "Simpan Pengaturan"}</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  );
}

export default withFreshState(PengaturanPage, { module: "settings" });
