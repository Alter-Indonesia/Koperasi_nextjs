import { handle } from "@/lib/http";
import { changeOwnPassword } from "@/lib/own-password";

// POST /api/v1/anggota/saya/password { current_password, new_password } — ganti password sendiri; semua sesi login diputus (masuk ulang)
export const POST = handle(changeOwnPassword, { module: "my_loans", action: "view", log: "change_password" });
