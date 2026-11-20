import "server-only";
import { one } from "@/lib/db";
import { HttpError } from "@/lib/http";

export type SettingType = "text" | "number" | "boolean" | "select";
export type SettingRow = {
  id: number; key: string; group_name: string; label: string; description: string | null;
  value_type: SettingType; value: unknown; config: { options?: { value: string; label: string }[]; min?: number; max?: number; step?: number; prefix?: string; suffix?: string; max_length?: number; pattern?: string; pattern_hint?: string };
};

/** Nilai satu pengaturan (jatuh ke `fallback` bila barisnya tidak ada atau nilainya kosong). */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await one<{ value: T | null }>("SELECT value FROM settings WHERE key = $1 AND deleted_at IS NULL", [key]);
  return r?.value ?? fallback;
}

/** Validasi nilai terhadap tipe + config barisnya (pengaturan baru otomatis tervalidasi tanpa kode tambahan). */
export function checkSettingValue(s: Pick<SettingRow, "label" | "value_type" | "config">, v: unknown): unknown {
  const c = s.config ?? {};
  switch (s.value_type) {
    case "boolean":
      if (typeof v !== "boolean") throw new HttpError(422, `${s.label}: harus ya/tidak`);
      return v;
    case "number": {
      if (typeof v !== "number" || !Number.isFinite(v)) throw new HttpError(422, `${s.label}: harus berupa angka`);
      if (c.min !== undefined && v < c.min) throw new HttpError(422, `${s.label}: minimal ${c.min}`);
      if (c.max !== undefined && v > c.max) throw new HttpError(422, `${s.label}: maksimal ${c.max}`);
      return v;
    }
    case "select": {
      if (typeof v !== "string" || !c.options?.some((o) => o.value === v)) throw new HttpError(422, `${s.label}: pilihan tidak valid`);
      return v;
    }
    default: {
      if (typeof v !== "string") throw new HttpError(422, `${s.label}: harus berupa teks`);
      const t = v.trim();
      if (t.length > (c.max_length ?? 500)) throw new HttpError(422, `${s.label}: maksimal ${c.max_length ?? 500} karakter`);
      if (c.pattern && !new RegExp(c.pattern).test(t)) throw new HttpError(422, `${s.label}: ${c.pattern_hint ?? "format tidak valid"}`);
      return t;
    }
  }
}
