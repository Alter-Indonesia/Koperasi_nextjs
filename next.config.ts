import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  serverExternalPackages: ["tesseract.js", "sharp"], // OCR KTP memakai worker thread & wasm, tidak boleh di-bundle
  partialPrefetching: true,
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
