import "server-only";
import { z } from "zod";
import { one, q } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { body, currentUser, HttpError, ok } from "@/lib/http";
import { UserFields } from "@/lib/system-schema";

const Input = z.object({
  current_password: z.string().min(1, "Password saat ini wajib diisi"),
  new_password: UserFields.password,
});

/** Handler ganti password sendiri (dipakai halaman profil Petugas & Anggota): verifikasi password lama, lalu putus semua sesi (masuk ulang). */
export async function changeOwnPassword(req: Request) {
  const me = currentUser();
  const d = await body(req, Input);
  const row = await one<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL", [me.id]);
  if (!(await verifyPassword(d.current_password, row?.password_hash ?? null))) throw new HttpError(422, "Password saat ini salah");
  if (d.current_password === d.new_password) throw new HttpError(422, "Password baru harus berbeda dari password saat ini");
  await q("UPDATE users SET password_hash = $1, updated_by = $2 WHERE id = $2", [await hashPassword(d.new_password), me.id]);
  await q("DELETE FROM sessions WHERE user_id = $1", [me.id]);
  return ok({ changed: true });
}
