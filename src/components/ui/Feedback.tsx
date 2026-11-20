"use client";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-chip bg-line-subtle", className)} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-warn bg-card px-5 py-4">
      <span className="text-body-sm text-warn-text">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-body-sm font-bold text-fg underline cursor-pointer">
          Coba lagi
        </button>
      )}
    </div>
  );
}

/** Notifikasi singkat di pojok kanan bawah */
export function Toast({ message, tone = "ok", onClose }: { message: string | null; tone?: "ok" | "warn"; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className={cx("fixed right-6 bottom-6 z-50 flex items-center gap-3 rounded-ctl px-4 py-3 text-body-sm font-bold", tone === "ok" ? "bg-inverse text-accent" : "bg-warn text-on-warn")}>
      {message}
      <button onClick={onClose} aria-label="Tutup" className="cursor-pointer opacity-80">
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

/** Panel modal sederhana (form tambah data) */
export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-inverse/40 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx("w-full rounded-card-xl bg-card p-6", wide ? "max-w-[960px]" : "max-w-[520px]")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-appbar font-bold text-fg">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="cursor-pointer text-fg-muted">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
