import { Sidebar, type NavItem } from "./Sidebar";

/**
 * Pola layout desktop (Admin & Owner): sidebar 240 tetap di kiri, konten dengan padding 32 dan jarak antar kartu 24.
 * Halaman cukup mengisi <PageHeader/> lalu grid kartu di dalam children.
 */
export function AppShell({
  menuLabel,
  items,
  user,
  onLogout,
  children,
}: {
  menuLabel: string;
  items: NavItem[];
  user: { name: string; role: string } | null;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar label={menuLabel} items={items} user={user} onLogout={onLogout} />
      <main className="ml-[240px] min-w-0 px-8 py-8">{children}</main>
    </div>
  );
}
