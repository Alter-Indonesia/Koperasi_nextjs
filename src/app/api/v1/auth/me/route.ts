import { BERANDA } from "@/lib/auth";
import { currentUser, handle, ok } from "@/lib/http";

// GET /api/v1/auth/me -> pengguna yang sedang login (401 bila belum)
export const GET = handle(async () => {
  const user = currentUser();
  return ok({ user, beranda: BERANDA[user.role] });
});
