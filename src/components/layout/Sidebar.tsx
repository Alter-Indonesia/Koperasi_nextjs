"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronsUpDown, LogOut, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/cx";
import { Avatar } from "@/components/ui/Avatar";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number | null; exact?: boolean; children?: NavItem[] };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Pola sidebar (design system: Nav/Active · Nav/Default)
 * Lebar 240 (size/sidebar), latar bg/inverse, item 208×44 radius 10, ikon Lucide 16 stroke 1.5.
 */
export function Sidebar({ groups, profileMenu = [], user, onLogout }: { groups: NavGroup[]; profileMenu?: NavItem[]; user: { name: string; role: string; email?: string } | null; onLogout: () => void }) {
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
          <div key={g.label || g.items[0]?.href} className="flex flex-col gap-1">
            {g.label && <div className="mb-1 px-2 text-caption font-bold tracking-[1px] text-fg-inverse-muted">{g.label}</div>}
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
      <ProfileMenu user={user} items={profileMenu} isActive={isActive} onLogout={onLogout} />
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

/**
 * Kartu profil di bawah sidebar: klik membuka menu ke atas (gaya Claude) — email, menu Sistem sesuai hak akses, lalu Keluar.
 * Tertutup bila klik di luar, tekan Esc, atau pindah halaman.
 */
function ProfileMenu({ user, items, isActive, onLogout }: { user: { name: string; role: string; email?: string } | null; items: NavItem[]; isActive: (i: NavItem) => boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  if (!user) return <div className="h-[56px] w-full animate-pulse rounded-[12px] bg-inverse-raised" />;
  return (
    <div className="relative">
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 bottom-full left-0 z-50 mb-2 flex flex-col gap-0.5 rounded-card border border-fg-inverse-muted/30 bg-inverse-raised p-2 shadow-lg">
            {user.email && <div className="truncate px-3 pt-1 pb-2 text-small text-fg-inverse-muted">{user.email}</div>}
            {items.map((it) => {
              const Icon = it.icon;
              const on = isActive(it);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cx("flex h-10 items-center gap-3 rounded-ctl px-3 text-body-sm hover:bg-inverse", on ? "font-bold text-accent" : "font-medium text-fg-inverse-nav")}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  {it.label}
                </Link>
              );
            })}
            {items.length > 0 && <div className="my-1 border-t border-fg-inverse-muted/30" />}
            <button role="menuitem" onClick={onLogout} className="flex h-10 cursor-pointer items-center gap-3 rounded-ctl px-3 text-left text-body-sm font-medium text-fg-inverse-nav hover:bg-inverse">
              <LogOut size={16} strokeWidth={1.5} />
              Keluar
            </button>
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative z-50 flex w-full cursor-pointer items-center gap-3 rounded-[12px] bg-inverse-raised px-3 py-2.5 text-left hover:bg-inverse-raised/80"
      >
        <Avatar name={user.name} size={36} tone="warn" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-body-sm font-bold text-fg-inverse">{user.name}</div>
          <div className="text-small text-fg-inverse-muted">{user.role}</div>
        </div>
        <ChevronsUpDown size={16} strokeWidth={1.5} className="shrink-0 text-fg-inverse-muted" />
      </button>
    </div>
  );
}
