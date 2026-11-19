import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { one, q } from "@/lib/db";
import { HttpError } from "@/lib/errors";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opt: crypto.ScryptOptions) => Promise<Buffer>;

export const SESSION_COOKIE = "koperasi_sesi";
const HARI = 24 * 60 * 60;
export const DURASI_SESI = { biasa: 12 * 60 * 60, ingat: 30 * HARI }; // detik
export const MAKS_GAGAL = 5;
export const KUNCI_MENIT = 15;

export type Role = "owner" | "admin" | "petugas" | "anggota";
export type SessionUser = { id: number; kode: string | null; nama: string; email: string; role: Role; wilayah_id: number | null; wilayah: string | null };

// ---------- password (format: scrypt$N$r$p$salt$hash, sama dengan scripts/db.mjs) ----------
export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pw.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [alg, N, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(pw.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Hash tiruan agar waktu respons sama ketika email tidak terdaftar (mencegah tebak-tebakan email). */
let dummyHash: Promise<string> | null = null;
export const dummyPasswordHash = () => (dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex")));

// ---------- sesi ----------
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function createSession(userId: number, ingat: boolean, req: Request) {
  const token = crypto.randomBytes(32).toString("base64url");
  const maxAge = ingat ? DURASI_SESI.ingat : DURASI_SESI.biasa;
  await q(
    `INSERT INTO sesi (id, pengguna_id, kedaluwarsa, user_agent, ip) VALUES ($1, $2, now() + make_interval(secs => $3), $4, $5)`,
    [sha256(token), userId, maxAge, req.headers.get("user-agent")?.slice(0, 300) ?? null, req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q("DELETE FROM sesi WHERE id = $1", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Data Access Layer: satu-satunya tempat membaca sesi. Mengembalikan null bila tidak login / kedaluwarsa. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return one<SessionUser>(
    `WITH s AS (
       UPDATE sesi SET terakhir_dipakai = now()
       WHERE id = $1 AND kedaluwarsa > now()
       RETURNING pengguna_id
     )
     SELECT u.id, u.kode, u.nama, u.email, u.role, u.wilayah_id, w.nama AS wilayah
     FROM s JOIN pengguna u ON u.id = s.pengguna_id LEFT JOIN wilayah w ON w.id = u.wilayah_id
     WHERE u.status = 'aktif'`,
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

/** Halaman awal tiap role setelah login */
export const BERANDA: Record<Role, string> = { admin: "/admin", owner: "/beranda", petugas: "/beranda", anggota: "/beranda" };

/** Hapus sesi kedaluwarsa (dipanggil sesekali saat login) */
export const bersihkanSesi = () => q("DELETE FROM sesi WHERE kedaluwarsa < now()");
