import { openapi } from "@/lib/openapi";
import { handle } from "@/lib/http";

// GET /api/v1/openapi.json — spesifikasi OpenAPI 3.1 (dokumen mentah, bukan format { data }).
// Publik (terpisah dari login aplikasi) agar bisa dibaca Scalar dan generator klien; isinya hanya bentuk API, bukan data.
export const GET = handle(async () => Response.json(openapi), { public: true });
