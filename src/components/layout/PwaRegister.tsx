"use client";
import { useEffect } from "react";

/** Mendaftarkan service worker (/sw.js) agar aplikasi bisa dipasang (PWA). Hanya di produksi supaya tidak mengganggu dev server. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
