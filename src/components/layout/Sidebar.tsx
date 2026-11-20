"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { Avatar } from "@/components/ui/Avatar";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number | null; exact?: boolean; children?: NavItem[] };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Pola sidebar (design system: Nav/Active · Nav/Default)
 * Lebar 240 (size/sidebar), latar bg/inverse, item 208×44 radius 10, ikon Lucide 16 stroke 1.5.
 */
export function Sidebar({ groups, user, onLogout }: { groups: NavGroup[]; user: { name: string; role: string } | null; onLogout: () => void }) {
  const path = usePathname();
  const isActive = (it: NavItem) => (it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/"));
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col bg-inverse px-4 pt-7 pb-6">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="flex size-10 items-center justify-center rounded-ctl bg-accent text-[20px] font-bold text-on-accent">K</span>
        <div>
          <div className="text-appbar font-bold text-fg-inverse">KoperasiKu</div>
          <div className="text-small text-fg-inverse-muted">Pinjamanku</div>
        </div>
      </div>
      {/* tiap kelompok punya label pembatas (mis. MENU ADMIN · MASTER DATA · SISTEM); area menu bisa di-scroll bila panjang */}
      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-4 [scrollbar-color:var(--fg-inverse-muted)_transparent] [scrollbar-width:thin]">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <div className="mb-1 px-2 text-caption font-bold tracking-[1px] text-fg-inverse-muted">{g.label}</div>
            {g.items.map((it) =>
              it.children ? (
                <ParentItem key={it.label} item={it} isActive={isActive} />
              ) : (
                <NavLink key={it.href} item={it} on={isActive(it)} />
              ),
            )}
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-3 rounded-[12px] bg-inverse-raised px-3 py-2.5">
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

const rowBase = "flex shrink-0 items-center gap-3 rounded-ctl text-body";

function Badge({ n, on }: { n?: number | null; on: boolean }) {
  return n ? <span className={cx("min-w-6 rounded-pill px-1.5 text-center text-caption font-bold leading-5", on ? "bg-inverse text-accent" : "bg-warn text-on-warn")}>{n}</span> : null;
}

function NavLink({ item, on, child }: { item: NavItem; on: boolean; child?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cx(rowBase, child ? "h-10 pr-4 pl-11 text-body-sm" : "h-11 px-4", on ? "bg-accent font-bold text-on-accent" : "font-medium text-fg-inverse-nav hover:bg-inverse-raised")}
    >
      {!child && <Icon size={16} strokeWidth={1.5} className={on ? "text-on-accent" : "text-fg-inverse-muted"} />}
      <span className="flex-1 truncate">{item.label}</span>
      <Badge n={item.badge} on={on} />
    </Link>
  );
}

/** Menu induk (mis. Master Data, Sistem): klik membuka/menutup sub menu; otomatis terbuka bila salah satu anak sedang aktif. */
function ParentItem({ item, isActive }: { item: NavItem; isActive: (i: NavItem) => boolean }) {
  const hasActive = !!item.children?.some(isActive);
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? hasActive;
  const Icon = item.icon;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className={cx(rowBase, "h-11 w-full cursor-pointer px-4 text-left hover:bg-inverse-raised", hasActive ? "font-bold text-fg-inverse" : "font-medium text-fg-inverse-nav")}
      >
        <Icon size={16} strokeWidth={1.5} className={hasActive ? "text-accent" : "text-fg-inverse-muted"} />
        <span className="flex-1 truncate">{item.label}</span>
        <ChevronDown size={16} strokeWidth={1.5} className={cx("text-fg-inverse-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && item.children?.map((c) => <NavLink key={c.href} item={c} on={isActive(c)} child />)}
    </div>
  );
}
