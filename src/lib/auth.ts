import "server-only";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { one, q } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { roleInfo } from "@/lib/rbac";

export const SESSION_COOKIE = "koperasi_sesi";
const DAY = 24 * 60 * 60;
export const SESSION_TTL = { normal: 12 * 60 * 60, remember: 30 * DAY }; // detik
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/** Kode role (tabel roles): 4 role bawaan (owner, admin, petugas, anggota) + role kustom. */
export type Role = string;
export type SessionUser = { id: number; code: string | null; name: string; email: string; role: Role; region_id: number | null; region_name: string | null };

// ---------- password: bcrypt (hash `$2a$12$…`, garam ada di dalam hash; sama dengan scripts/db.mjs) ----------
export const BCRYPT_COST = 12;
/** bcrypt hanya memakai 72 byte pertama password, jadi batas itu juga dipakai validasi input. */
export const PASSWORD_MAX_BYTES = 72;

export const hashPassword = (pw: string) => bcrypt.hash(pw.normalize("NFKC"), BCRYPT_COST);

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored || !/^\$2[aby]\$/.test(stored)) return false;
  return bcrypt.compare(pw.normalize("NFKC"), stored);
}

/** Hash tiruan agar waktu respons sama ketika email tidak terdaftar (mencegah tebak-tebakan email). */
let dummyHash: Promise<string> | null = null;
export const dummyPasswordHash = () => (dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex")));

// ---------- sesi ----------
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Token sesi dari header `Authorization: Bearer …` (klien mobile/API) atau, bila tidak ada, dari cookie (web). */
async function ambilToken(): Promise<string | undefined> {
  const bearer = (await headers()).get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return bearer ?? (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Membuat sesi + cookie; mengembalikan token yang sama agar bisa dikirim ke klien yang memakai Bearer. */
export async function createSession(userId: number, ingat: boolean, req: Request) {
  const token = crypto.randomBytes(32).toString("base64url");
  const maxAge = ingat ? SESSION_TTL.remember : SESSION_TTL.normal;
  await q(
    `INSERT INTO sessions (id, user_id, expires_at, user_agent, ip) VALUES ($1, $2, now() + make_interval(secs => $3), $4, $5)`,
    [sha256(token), userId, maxAge, req.headers.get("user-agent")?.slice(0, 300) ?? null, req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return { token, maxAge };
}

export async function destroySession() {
  const jar = await cookies();
  const token = await ambilToken();
  if (token) await q("DELETE FROM sessions WHERE id = $1", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Data Access Layer: satu-satunya tempat membaca sesi. Mengembalikan null bila tidak login / kedaluwarsa. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await ambilToken();
  if (!token) return null;
  return one<SessionUser>(
    `WITH s AS (
       UPDATE sessions SET last_used_at = now()
       WHERE id = $1 AND expires_at > now()
       RETURNING user_id
     )
     SELECT u.id, u.code, u.name, u.email, u.role, u.region_id, r.name AS region_name
     FROM s JOIN users u ON u.id = s.user_id LEFT JOIN regions r ON r.id = u.region_id
     WHERE u.status = 'aktif' AND u.deleted_at IS NULL`,
    [sha256(token)],
  );
}

/** Wajib login; bila `roles` diisi, role pengguna harus termasuk di dalamnya. */
export async function requireUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Sesi berakhir, silakan masuk kembali");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Anda tidak punya akses ke data ini");
  return user;
}

/** Halaman awal role setelah login: /<area> (admin | owner | petugas | anggota), sesuai kolom roles.area */
export const homePathFor = async (role: string) => `/${(await roleInfo(role)).area}`;

/** Hapus sesi kedaluwarsa (dipanggil sesekali saat login) */
export const purgeExpiredSessions = () => q("DELETE FROM sessions WHERE expires_at < now()");
