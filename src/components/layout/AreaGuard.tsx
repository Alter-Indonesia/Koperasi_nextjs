import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { roleInfo } from "@/lib/rbac";
import { canEnterArea, type Area } from "@/lib/permissions";
import { AreaShell } from "./AreaShell";

/** Validasi sesi sebenarnya (proxy hanya mengecek keberadaan cookie). Membaca cookie => harus di dalam <Suspense>. */
async function Guard({ area, children }: { area: Area; children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { area: userArea } = await roleInfo(user.role);
  if (!canEnterArea(userArea, area)) redirect(`/${userArea}`);
  return <AreaShell area={area}>{children}</AreaShell>;
}

/** Layout satu area: pengguna harus login dan role-nya harus berada di area ini. */
export function AreaGuard({ area, children }: { area: Area; children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Guard area={area}>{children}</Guard>
    </Suspense>
  );
}
