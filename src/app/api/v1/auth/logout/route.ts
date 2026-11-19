import { destroySession } from "@/lib/auth";
import { handle, ok } from "@/lib/http";

// POST /api/v1/auth/logout -> hapus sesi di DB & cookie (aman dipanggil walau sesi sudah habis)
export const POST = handle(
  async () => {
    await destroySession();
    return ok({ keluar: true });
  },
  { public: true },
);
