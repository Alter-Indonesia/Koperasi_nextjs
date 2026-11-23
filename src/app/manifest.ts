import type { MetadataRoute } from "next";

// Warna mengikuti tema Default (src/styles/tokens.css): bg-inverse #0A0A0A, bg-canvas #F5F5F5.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KoperasiKu",
    short_name: "KoperasiKu",
    description: "Aplikasi simpan pinjam & penagihan koperasi",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F5F5",
    theme_color: "#0A0A0A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
