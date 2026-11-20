import { ApiReference } from "@scalar/nextjs-api-reference";

// GET /docs — dokumentasi API interaktif (Scalar) dari /api/v1/openapi.json.
// Publik, terpisah dari login aplikasi. Untuk "Test Request" ke endpoint data, login dulu di /login (browser yang sama).
export const GET = ApiReference({
  url: "/api/v1/openapi.json",
  pageTitle: "API KoperasiKu",
  theme: "default",
  telemetry: false, // jangan kirim data pemakaian ke Scalar
  showDeveloperTools: "never", // sembunyikan tombol layanan cloud Scalar (Configure, Share, Generate SDK, Deploy)
  persistAuth: true,
});
