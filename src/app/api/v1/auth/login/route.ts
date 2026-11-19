import { z } from "zod";
import { one, q } from "@/lib/db";
import { BERANDA, bersihkanSesi, createSession, dummyPasswordHash, KUNCI_MENIT, MAKS_GAGAL, verifyPassword, type Role } from "@/lib/auth";
import { body, handle, HttpError, ok } from "@/lib/http";

const Login = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid").max(120),
  password: z.string().min(1, "Password wajib diisi").max(200),
  ingat: z.boolean().default(false),
});

type Akun = { id: number; nama: string; email: string; role: Role; password_hash: string | null; gagal_login: number; terkunci_menit: number | null };
const SALAH = "Email atau password salah";

// POST /api/v1/auth/login { email, password, ingat } -> set cookie sesi (httpOnly)
export const POST = handle(
  async (req: Request) => {
    const d = await body(req, Login);
    const akun = await one<Akun>(
      `SELECT id, nama, email, role, password_hash, gagal_login,
              CEIL(EXTRACT(EPOCH FROM (terkunci_sampai - now())) / 60)::int AS terkunci_menit
       FROM pengguna WHERE lower(email) = $1 AND status = 'aktif'`,
      [d.email],
    );
    if (!akun) {
      await verifyPassword(d.password, await dummyPasswordHash()); // samakan waktu respons
      throw new HttpError(401, SALAH);
    }
    if (akun.terkunci_menit && akun.terkunci_menit > 0)
      throw new HttpError(429, `Terlalu banyak percobaan. Coba lagi dalam ${akun.terkunci_menit} menit.`);

    if (!(await verifyPassword(d.password, akun.password_hash))) {
      const gagal = akun.gagal_login + 1;
      if (gagal >= MAKS_GAGAL) {
        await q(`UPDATE pengguna SET gagal_login = 0, terkunci_sampai = now() + make_interval(mins => $2) WHERE id = $1`, [akun.id, KUNCI_MENIT]);
        throw new HttpError(429, `Terlalu banyak percobaan. Akun dikunci ${KUNCI_MENIT} menit.`);
      }
      await q("UPDATE pengguna SET gagal_login = $2 WHERE id = $1", [akun.id, gagal]);
      throw new HttpError(401, SALAH);
    }

    await q("UPDATE pengguna SET gagal_login = 0, terkunci_sampai = NULL, login_terakhir = now() WHERE id = $1", [akun.id]);
    await createSession(akun.id, d.ingat, req);
    if (Math.random() < 0.1) await bersihkanSesi();
    return ok({ user: { id: akun.id, nama: akun.nama, email: akun.email, role: akun.role }, beranda: BERANDA[akun.role] });
  },
  { public: true },
);
