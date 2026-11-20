"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/Form";
import { ApiError } from "@/lib/api";

export type Values = Record<string, string | boolean>;
export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "email" | "password" | "select" | "toggle" | "textarea";
  required?: boolean | ("baru" | "edit")[]; // true = selalu wajib; daftar = wajib hanya di mode itu
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  only?: ("baru" | "edit")[]; // tampil hanya di mode tertentu (mode lihat selalu menyembunyikan password)
  wide?: boolean; // memenuhi dua kolom
  min?: number;
  max?: number;
  readOnlyOn?: ("edit")[]; // tidak bisa diubah saat edit (mis. kode)
};
export type Mode = "baru" | "lihat" | "edit";

const isRequired = (f: FieldDef, mode: Mode) => (Array.isArray(f.required) ? f.required.includes(mode as "baru" | "edit") : !!f.required);

/**
 * Form generik tiga mode: `baru`, `lihat` (hanya baca), `edit`. Tombol Simpan/Batal ada di bawah form.
 * Pesan error ditampilkan di bawah kolomnya; error 400 dari server (zod) dipetakan ke kolom yang dimaksud.
 */
export function EntityForm({
  title, mode, fields, initial, onSubmit, onCancel, submitLabel, children,
}: {
  title: string;
  mode: Mode;
  fields: FieldDef[];
  initial: Values;
  onSubmit?: (v: Values) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  children?: React.ReactNode; // kolom kanan (riwayat, info tambahan)
}) {
  const readOnly = mode === "lihat";
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = fields.filter((f) => !f.only || (mode !== "lihat" && f.only.includes(mode as "baru" | "edit")));

  const change = (k: string, val: string | boolean) => { setV((x) => ({ ...x, [k]: val })); setErrors((x) => ({ ...x, [k]: undefined })); };

  function validate() {
    const e: Record<string, string> = {};
    for (const f of shown) {
      const val = v[f.key];
      if (isRequired(f, mode) && (val === "" || val === undefined)) { e[f.key] = `${f.label} wajib diisi`; continue; }
      if (f.type === "number" && val !== "" && val !== undefined) {
        const n = Number(val);
        if (!Number.isFinite(n)) e[f.key] = `${f.label} harus berupa angka`;
        else if (f.min !== undefined && n < f.min) e[f.key] = `${f.label} minimal ${f.min}`;
        else if (f.max !== undefined && n > f.max) e[f.key] = `${f.label} maksimal ${f.max}`;
      }
    }
    return e;
  }

  async function save() {
    setErr(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length || !onSubmit) return;
    setSaving(true);
    try {
      await onSubmit(v);
    } catch (x) {
      if (x instanceof ApiError && Array.isArray(x.details)) {
        const m: Record<string, string> = {};
        for (const i of x.details as { path?: string[]; message?: string }[]) { const k = String(i.path?.[0]); if (shown.some((f) => f.key === k) && i.message) m[k] = i.message; }
        setErrors(m);
        setErr("Periksa kembali isian yang ditandai.");
      } else setErr(x instanceof ApiError ? x.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
      <div className="flex flex-col gap-6">
        <Card title={title}>
          <div className="grid grid-cols-2 gap-4">
            {shown.map((f) => {
              const disabled = readOnly || (mode === "edit" && f.readOnlyOn?.includes("edit"));
              const val = v[f.key];
              return (
                <div key={f.key} className={f.wide || f.type === "textarea" ? "col-span-2" : undefined}>
                  {f.type === "toggle" ? (
                    <div className="flex items-center justify-between gap-4 rounded-ctl border border-line px-4 py-3">
                      <div>
                        <div className="text-body-sm font-bold text-fg">{f.label}</div>
                        {f.help && <div className="text-small text-fg-muted">{f.help}</div>}
                      </div>
                      <Toggle on={!!val} label={f.label} onChange={disabled ? undefined : (x) => change(f.key, x)} />
                    </div>
                  ) : (
                    <Field label={f.label} wajib={!readOnly && isRequired(f, mode)} error={errors[f.key]}>
                      {f.type === "select" ? (
                        <Select value={String(val ?? "")} disabled={disabled} onChange={(e) => change(f.key, e.target.value)}>
                          <option value="">Pilih…</option>
                          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                      ) : f.type === "textarea" ? (
                        <Textarea value={String(val ?? "")} disabled={disabled} placeholder={f.placeholder} onChange={(e) => change(f.key, e.target.value)} />
                      ) : (
                        <Input
                          type={f.type === "number" ? "number" : f.type}
                          value={String(val ?? "")}
                          disabled={disabled}
                          min={f.min}
                          max={f.max}
                          placeholder={f.placeholder}
                          autoComplete={f.type === "password" ? "new-password" : undefined}
                          onChange={(e) => change(f.key, e.target.value)}
                        />
                      )}
                      {f.help && !readOnly && <span className="text-small text-fg-subtle">{f.help}</span>}
                    </Field>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
        {!readOnly && (
          <div className="flex flex-col items-end gap-2">
            {err && <span className="text-small font-medium text-warn-text">{err}</span>}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="lg" onClick={onCancel} disabled={saving}>Batal</Button>
              <Button size="lg" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : submitLabel ?? (mode === "baru" ? "Simpan" : "Simpan Perubahan")}</Button>
            </div>
            <span className="text-small text-fg-subtle"><span className="text-warn-text">*</span> wajib diisi</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
