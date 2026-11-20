import { z } from "zod";

/** Skema bersama master data (dipakai route POST dan PATCH). */
export const TenorFields = {
  months: z.number().int().min(1, "Tenor minimal 1 bulan").max(60, "Tenor maksimal 60 bulan"),
  label: z.string().trim().max(40).optional(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
};
