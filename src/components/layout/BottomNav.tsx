"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";
import type { NavGroup } from "./Sidebar";

/** Navigasi bawah untuk layar HP/tablet (aplikasi petugas): ikon dalam pil kuning bila aktif, label di bawahnya. Tampil di bawah lg. */
export function BottomNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const items = groups.flatMap((g) => g.items).filter((i) => !i.children);
  return (
    <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
      <ul className="mx-auto flex max-w-[720px]">
        {items.map((it) => {
          const on = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <li key={it.href} className="flex-1">
              <Link href={it.href} aria-current={on ? "page" : undefined} className="flex flex-col items-center gap-1 px-2 pt-2.5 pb-2">
                <span className={cx("flex h-8 w-16 items-center justify-center rounded-pill", on ? "bg-accent text-on-accent" : "text-fg-muted")}>
                  <Icon size={20} strokeWidth={1.5} />
                </span>
                <span className={cx("text-caption", on ? "font-bold text-fg" : "font-medium text-fg-muted")}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
