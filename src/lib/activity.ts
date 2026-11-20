import "server-only";
import { q } from "@/lib/db";

export type ActivityEntry = {
  user_id?: number | null;
  user_name?: string | null;
  action: string;
  module?: string | null;
  entity_id?: number | null;
  method?: string | null;
  path?: string | null;
  status_code?: number | null;
  ip?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown> | null;
};

/** Catat satu aktivitas. Tidak pernah melempar error: log gagal tidak boleh menggagalkan permintaan. Jangan masukkan nilai sensitif ke `details`. */
export async function logActivity(e: ActivityEntry) {
  try {
    await q(
      `INSERT INTO activity_logs (user_id, user_name, action, module, entity_id, method, path, status_code, ip, user_agent, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [e.user_id ?? null, e.user_name ?? null, e.action, e.module ?? null, e.entity_id ?? null, e.method ?? null, e.path ?? null, e.status_code ?? null, e.ip ?? null, e.user_agent?.slice(0, 300) ?? null, e.details ? JSON.stringify(e.details) : null],
    );
  } catch (err) {
    console.error("gagal mencatat aktivitas", err);
  }
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
