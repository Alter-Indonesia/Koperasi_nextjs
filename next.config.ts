import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  serverExternalPackages: ["tesseract.js", "sharp"], // OCR KTP memakai worker thread & wasm, tidak boleh di-bundle
  partialPrefetching: true,
  // Validasi "instant navigation" (peringatan dev overlay) hanya untuk segmen yang meminta lewat `export const instant`.
  // Halaman area memakai sesi + data REST di klien sehingga memang tidak statis; tanpa ini semua page.tsx dilaporkan "dropped from rendering".
  experimental: { instantInsights: { validationLevel: "manual-warning" } },
  async redirects() {
    // Sementara aplikasi baru punya halaman Admin
    return [{ source: "/", destination: "/admin", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
