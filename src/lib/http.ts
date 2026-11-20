import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType } from "zod";
import { logActivity, clientIp } from "@/lib/activity";
import { requireUser, type SessionUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { hasPermission } from "@/lib/rbac";
import { type Action, type Module } from "@/lib/permissions";

export { HttpError };

/** Format respons REST: { data, meta? } atau { error: { message, details? } } */
export const ok = (data: unknown, meta?: Record<string, unknown>, status = 200) =>
  Response.json(meta ? { data, meta } : { data }, { status });

export const created = (data: unknown) => ok(data, undefined, 201);

type Access = {
  public?: true; // tanpa login (mis. /auth/login)
  module?: Module; // wajib login + hak akses modul; tanpa module = login saja, role apa pun (mis. /auth/me)
  action?: Action; // default dari method HTTP
  log?: string; // nama aksi di log aktivitas (default: create/update/delete)
};

const userStore = new AsyncLocalStorage<SessionUser>();

/** Pengguna yang sedang login di dalam handler (sudah diverifikasi oleh `handle`). */
export function currentUser(): SessionUser {
  const u = userStore.getStore();
  if (!u) throw new HttpError(401, "Sesi berakhir, silakan masuk kembali");
  return u;
}

const METHOD_ACTION: Record<string, Action> = { GET: "view", HEAD: "view", POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };
const LOG_ACTION: Record<string, string> = { POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };

/**
 * Pola semua endpoint:
 *   export const GET = handle(async (req) => ok(data), { module: "members" })
 * - default: wajib login (role apa pun); `{ public: true }` untuk endpoint tanpa login
 * - `{ module }`: role pengguna harus punya hak akses modul itu; aksi (view/create/update/delete) mengikuti method HTTP
 *   (GET → view, POST → create, PUT/PATCH → update, DELETE → delete), bisa ditimpa dengan `action`
 * - request yang mengubah data (POST/PUT/PATCH/DELETE) harus dari origin yang sama dan dicatat di log aktivitas
 * - HttpError -> status & pesan; ZodError -> 400 + detail; error lain -> 500
 */
export function handle<A extends [Request, ...unknown[]]>(fn: (...args: A) => Promise<Response>, akses: Access = {}) {
  return async (...args: A): Promise<Response> => {
    const req = args[0];
    const mutation = req.method !== "GET" && req.method !== "HEAD";
    let user: SessionUser | undefined;
    let bodyKeys: string[] | undefined;
    const moduleAccess = akses.module ? { module: akses.module, action: akses.action, log: akses.log } : undefined;
    let res: Response;
    try {
      if (mutation) cekOrigin(req);
      if (akses.public) return await fn(...args);
      user = await requireUser();
      if (moduleAccess) {
        const action = moduleAccess.action ?? METHOD_ACTION[req.method] ?? "view";
        if (!(await hasPermission(user.role, moduleAccess.module, action))) throw new HttpError(403, "Anda tidak punya akses ke data ini");
      }
      if (mutation && req.headers.get("content-type")?.includes("application/json")) {
        // hanya nama kolom yang dicatat, tidak pernah nilainya
        bodyKeys = await req.clone().json().then((j) => (j && typeof j === "object" ? Object.keys(j) : undefined)).catch(() => undefined);
      }
      res = await userStore.run(user, () => fn(...args));
    } catch (e) {
      // sinyal internal Next.js (prerender, redirect, notFound) harus diteruskan, bukan dijadikan 500
      unstable_rethrow(e);
      if (e instanceof HttpError) res = Response.json({ error: { message: e.message } }, { status: e.status });
      else if (e instanceof ZodError) res = Response.json({ error: { message: "Data tidak valid", details: e.issues } }, { status: 400 });
      else {
        console.error(e);
        res = Response.json({ error: { message: "Terjadi kesalahan di server" } }, { status: 500 });
      }
    }
    if (user && mutation) await catat(req, args[1], user, moduleAccess, res.status, bodyKeys);
    return res;
  };
}

async function catat(req: Request, ctx: unknown, user: SessionUser, akses: { module: Module; log?: string } | undefined, status: number, bodyKeys?: string[]) {
  const params = (await (ctx as { params?: Promise<Record<string, string>> } | undefined)?.params?.catch(() => undefined)) ?? {};
  const idNum = Number(params.id);
  await logActivity({
    user_id: user.id, user_name: user.name, action: akses?.log ?? LOG_ACTION[req.method] ?? req.method.toLowerCase(), module: akses?.module ?? null,
    entity_id: Number.isInteger(idNum) && idNum > 0 ? idNum : null, method: req.method, path: new URL(req.url).pathname, status_code: status,
    ip: clientIp(req), user_agent: req.headers.get("user-agent"), details: bodyKeys ? { fields: bodyKeys } : null,
  });
}

/** Perlindungan CSRF sederhana: tolak request yang mengubah data dari situs lain. */
function cekOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // klien non-browser (curl, server) tidak mengirim Origin
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new HttpError(403, "Permintaan ditolak (origin tidak sesuai)");
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Body harus berupa JSON");
  }
  return schema.parse(json);
}

export function intParam(v: string | null, def: number, min = 1, max = 1000) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : def;
}

export function dateParam(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function idParam(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "ID tidak valid");
  return n;
}
