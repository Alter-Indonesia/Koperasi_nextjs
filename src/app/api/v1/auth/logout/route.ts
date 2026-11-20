import { clientIp, logActivity } from "@/lib/activity";
import { destroySession, getSessionUser } from "@/lib/auth";
import { handle, ok } from "@/lib/http";

// POST /api/v1/auth/logout -> hapus sesi (dari Bearer atau cookie) di DB & cookie (aman dipanggil walau sesi sudah habis)
export const POST = handle(
  async (req: Request) => {
    const user = await getSessionUser();
    await destroySession();
    if (user) await logActivity({ user_id: user.id, user_name: user.name, action: "logout", module: "auth", method: "POST", path: "/api/v1/auth/logout", status_code: 200, ip: clientIp(req), user_agent: req.headers.get("user-agent") });
    return ok({ logged_out: true });
  },
  { public: true },
);
