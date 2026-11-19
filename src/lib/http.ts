import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType } from "zod";
import { requireUser, type Role, type SessionUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";

export { HttpError };

/** Format respons REST: { data, meta? } atau { error: { message, details? } } */
export const ok = (data: unknown, meta?: Record<string, unknown>, status = 200) =>
  Response.json(meta ? { data, meta } : { data }, { status });

export const created = (data: unknown) => ok(data, undefined, 201);

/** Kelompok role yang dipakai berulang */
export const ROLES = {
  admin: ["admin", "owner"] as const satisfies readonly Role[],
  semuaInternal: ["admin", "owner", "petugas"] as const satisfies readonly Role[],
};

type Akses =
  | { public: true } // tanpa login (mis. /auth/login)
  | { roles?: readonly Role[] }; // wajib login; bila roles diisi hanya role tsb

const userStore = new AsyncLocalStorage<SessionUser>();

/** Pengguna yang sedang login di dalam handler (sudah diverifikasi oleh `handle`). */
export function currentUser(): SessionUser {
  const u = userStore.getStore();
  if (!u) throw new HttpError(401, "Sesi berakhir, silakan masuk kembali");
  return u;
}

/**
 * Pola semua endpoint:
 *   export const GET = handle(async (req) => ok(data), { roles: ROLES.admin })
 * - default: wajib login (role apa pun); `{ public: true }` untuk endpoint tanpa login
 * - request yang mengubah data (POST/PUT/PATCH/DELETE) harus dari origin yang sama
 * - HttpError -> status & pesan; ZodError -> 400 + detail; error lain -> 500
 */
export function handle<A extends [Request, ...unknown[]]>(fn: (...args: A) => Promise<Response>, akses: Akses = {}) {
  return async (...args: A): Promise<Response> => {
    try {
      const req = args[0];
      if (req.method !== "GET" && req.method !== "HEAD") cekOrigin(req);
      if ("public" in akses) return await fn(...args);
      const user = await requireUser(akses.roles);
      return await userStore.run(user, () => fn(...args));
    } catch (e) {
      // sinyal internal Next.js (prerender, redirect, notFound) harus diteruskan, bukan dijadikan 500
      unstable_rethrow(e);
      if (e instanceof HttpError) return Response.json({ error: { message: e.message } }, { status: e.status });
      if (e instanceof ZodError)
        return Response.json({ error: { message: "Data tidak valid", details: e.issues } }, { status: 400 });
      console.error(e);
      return Response.json({ error: { message: "Terjadi kesalahan di server" } }, { status: 500 });
    }
  };
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
