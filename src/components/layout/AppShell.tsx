import { Sidebar, type NavGroup, type NavItem } from "./Sidebar";

/**
 * Pola layout desktop (Admin & Owner): sidebar 240 tetap di kiri, konten dengan padding 32 dan jarak antar kartu 24.
 * Halaman cukup mengisi <PageHeader/> lalu grid kartu di dalam children.
 */
export function AppShell({
  groups,
  profileMenu,
  user,
  onLogout,
  children,
}: {
  groups: NavGroup[];
  profileMenu?: NavItem[];
  user: { name: string; role: string; email?: string } | null;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar groups={groups} profileMenu={profileMenu} user={user} onLogout={onLogout} />
      <main className="ml-[240px] min-w-0 px-8 py-8">{children}</main>
    </div>
  );
}
