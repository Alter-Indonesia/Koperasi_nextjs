"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { Avatar } from "@/components/ui/Avatar";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number | null };

/**
 * Pola sidebar (design system: Nav/Active · Nav/Default)
 * Lebar 240 (size/sidebar), latar bg/inverse, item 208×44 radius 10, ikon Lucide 16 stroke 1.5.
 */
export function Sidebar({ label, items, user, onLogout }: { label: string; items: NavItem[]; user: { name: string; role: string } | null; onLogout: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => (href === items[0].href ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col bg-inverse px-4 pt-7 pb-6">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="flex size-10 items-center justify-center rounded-ctl bg-accent text-[20px] font-bold text-on-accent">K</span>
        <div>
          <div className="text-appbar font-bold text-fg-inverse">KoperasiKu</div>
          <div className="text-small text-fg-inverse-muted">Simpan Pinjam</div>
        </div>
      </div>
      <div className="mb-2 px-2 text-caption font-bold tracking-[1px] text-fg-inverse-muted">{label}</div>
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const on = isActive(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cx(
                "flex h-11 items-center gap-3 rounded-ctl px-4 text-body",
                on ? "bg-accent font-bold text-on-accent" : "font-medium text-fg-inverse-nav hover:bg-inverse-raised",
              )}
            >
              <Icon size={16} strokeWidth={1.5} className={on ? "text-on-accent" : "text-fg-inverse-muted"} />
              <span className="flex-1 truncate">{it.label}</span>
              {!!it.badge && (
                <span className={cx("min-w-6 rounded-pill px-1.5 text-center text-caption font-bold leading-5", on ? "bg-inverse text-accent" : "bg-warn text-on-warn")}>
                  {it.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-3 rounded-[12px] bg-inverse-raised px-3 py-2.5">
        {user ? (
          <>
            <Avatar name={user.name} size={36} tone="warn" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-body-sm font-bold text-fg-inverse">{user.name}</div>
              <div className="text-small text-fg-inverse-muted">{user.role}</div>
            </div>
            <button onClick={onLogout} title="Keluar" aria-label="Keluar" className="cursor-pointer rounded-chip p-2 text-fg-inverse-muted hover:bg-inverse hover:text-fg-inverse">
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </>
        ) : (
          <div className="h-9 w-full animate-pulse rounded-chip bg-inverse" />
        )}
      </div>
    </aside>
  );
}
