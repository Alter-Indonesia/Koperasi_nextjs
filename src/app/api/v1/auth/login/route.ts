import { z } from "zod";
import { one, q } from "@/lib/db";
import { clientIp, logActivity } from "@/lib/activity";
import { homePathFor, purgeExpiredSessions, createSession, dummyPasswordHash, LOCK_MINUTES, MAX_FAILED_LOGINS, PASSWORD_MAX_BYTES, verifyPassword, type Role } from "@/lib/auth";
import { body, handle, HttpError, ok } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";

const Login = z.object({
  identifier: z.string().trim().min(1, "Isi email atau no. HP").max(120).optional(), // email ATAU no. HP
  email: z.string().trim().max(120).optional(), // nama lama untuk `identifier` (klien lama)
  password: z
    .string()
    .min(1, "Password wajib diisi")
    .refine((p) => Buffer.byteLength(p) <= PASSWORD_MAX_BYTES, "Password terlalu panjang"),
  remember: z.boolean().default(false),
  token: z.boolean().default(false), // true = sertakan token Bearer di respons (klien mobile/API)
}).refine((d) => (d.identifier ?? d.email), { message: "Isi email atau no. HP", path: ["identifier"] });

type Account = { id: number; name: string; email: string | null; role: Role; password_hash: string | null; failed_login_count: number; locked_minutes: number | null };
const WRONG = "Email atau password salah";

// POST /api/v1/auth/login { identifier (email atau no. HP), password, remember, token? } -> set cookie sesi (httpOnly); token:true juga mengembalikan token Bearer
export const POST = handle(
  async (req: Request) => {
    const d = await body(req, Login);
    const identifier = (d.identifier ?? d.email)!;
    const byEmail = identifier.includes("@");
    const email = byEmail ? identifier.toLowerCase() : null;
    const phone = byEmail ? null : normalizePhone(identifier);
    const trace = { module: "auth", method: "POST", path: "/api/v1/auth/login", ip: clientIp(req), user_agent: req.headers.get("user-agent") };
    const failed = (status: number, account?: Account) =>
      logActivity({ ...trace, user_id: account?.id, user_name: account?.name, action: "login_failed", status_code: status, details: { identifier } });

    const account = await one<Account>(
      `SELECT id, name, email, role, password_hash, failed_login_count,
              CEIL(EXTRACT(EPOCH FROM (locked_until - now())) / 60)::int AS locked_minutes
       FROM users
       WHERE status = 'aktif' AND deleted_at IS NULL
         AND (($1::text IS NOT NULL AND lower(email) = $1) OR ($2::text IS NOT NULL AND normalize_phone(phone) = $2))`,
      [email, phone],
    );
    if (!account) {
      await verifyPassword(d.password, await dummyPasswordHash()); // samakan waktu respons
      await failed(401);
      throw new HttpError(401, WRONG);
    }
    if (account.locked_minutes && account.locked_minutes > 0) {
      await failed(429, account);
      throw new HttpError(429, `Terlalu banyak percobaan. Coba lagi dalam ${account.locked_minutes} menit.`);
    }

    if (!(await verifyPassword(d.password, account.password_hash))) {
      const count = account.failed_login_count + 1;
      if (count >= MAX_FAILED_LOGINS) {
        await q(`UPDATE users SET failed_login_count = 0, locked_until = now() + make_interval(mins => $2) WHERE id = $1`, [account.id, LOCK_MINUTES]);
        await failed(429, account);
        throw new HttpError(429, `Terlalu banyak percobaan. Akun dikunci ${LOCK_MINUTES} menit.`);
      }
      await q("UPDATE users SET failed_login_count = $2 WHERE id = $1", [account.id, count]);
      await failed(401, account);
      throw new HttpError(401, WRONG);
    }

    await q("UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [account.id]);
    const session = await createSession(account.id, d.remember, req);
    if (Math.random() < 0.1) await purgeExpiredSessions();
    await logActivity({ ...trace, user_id: account.id, user_name: account.name, action: "login", status_code: 200 });
    return ok({
      user: { id: account.id, name: account.name, email: account.email, role: account.role },
      home: await homePathFor(account.role),
      ...(d.token && { token: session.token, token_type: "Bearer", expires_in: session.maxAge }),
    });
  },
  { public: true },
);
