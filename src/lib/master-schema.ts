import { z } from "zod";

export const TENOR_UNITS = ["bulan", "hari"] as const;
export const TENOR_MAX = { bulan: 60, hari: 365 } as const;

/** Skema bersama master data (dipakai route POST dan PATCH). */
export const TenorFields = {
  duration: z.number().int().min(1, "Lama tenor minimal 1").max(365, "Lama tenor maksimal 365"),
  unit: z.enum(TENOR_UNITS, { error: "Satuan harus bulan atau hari" }),
  interest_rate_percent: z.number().min(0, "Jasa minimal 0%").max(100, "Jasa maksimal 100%"),
  label: z.string().trim().max(40).optional(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
};
