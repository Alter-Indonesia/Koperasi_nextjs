/** Modul & aksi untuk hak akses per role (dipakai server dan klien; tidak boleh mengimpor modul server-only). */
export const MODULES = [
  { code: "dashboard", label: "Dashboard" },
  { code: "members", label: "Anggota" },
  { code: "loans", label: "Pinjaman" },
  { code: "loan_approvals", label: "Persetujuan Pinjaman" },
  { code: "due_dates", label: "Jatuh Tempo" },
  { code: "payments", label: "Verifikasi Pembayaran" },
  { code: "assignments", label: "Penugasan Petugas" },
  { code: "reminders", label: "Pengingat Tagihan" },
  { code: "reports", label: "Laporan Penagihan" },
  { code: "regions", label: "Master Wilayah" },
  { code: "tenors", label: "Master Tenor" },
  { code: "users", label: "Pengguna" },
  { code: "roles", label: "Role & Hak Akses" },
  { code: "activity_logs", label: "Log Aktivitas" },
] as const;

export type Module = (typeof MODULES)[number]["code"];
export const ACTIONS = ["view", "create", "update", "delete"] as const;
export type Action = (typeof ACTIONS)[number];
export const ACTION_LABEL: Record<Action, string> = { view: "Lihat", create: "Tambah", update: "Ubah", delete: "Hapus" };

/** Area menu: tiap role punya satu area; halaman awal = /<area>. */
export const AREAS = ["admin", "owner", "petugas", "anggota"] as const;
export type Area = (typeof AREAS)[number];
export const AREA_LABEL: Record<Area, string> = { admin: "Admin", owner: "Owner", petugas: "Petugas", anggota: "Anggota" };

export type PermissionMap = Partial<Record<Module, Action[]>>;
export const can = (p: PermissionMap | undefined, module: Module, action: Action = "view") => !!p?.[module]?.includes(action);

/** Aksi yang bermakna per modul (matriks hak akses hanya menampilkan ini). */
export const MODULE_ACTIONS: Record<Module, Action[]> = {
  dashboard: ["view"],
  members: ["view", "create", "update", "delete"],
  loans: ["view", "create", "update", "delete"],
  loan_approvals: ["view", "update"],
  due_dates: ["view"],
  payments: ["view", "update"],
  assignments: ["view", "create"],
  reminders: ["view", "create", "update"],
  reports: ["view"],
  regions: ["view", "create", "update", "delete"],
  tenors: ["view", "create", "update", "delete"],
  users: ["view", "create", "update", "delete"],
  roles: ["view", "create", "update", "delete"],
  activity_logs: ["view"],
};

/** Label aksi di log aktivitas. */
export const ACTIVITY_LABEL: Record<string, string> = {
  login: "Login", login_failed: "Login gagal", logout: "Logout", create: "Tambah", update: "Ubah", delete: "Hapus", verify: "Verifikasi bayar", send: "Kirim pengingat",
  auto_assign: "Bagi otomatis", upload: "Unggah", ocr: "Baca KTP", update_permissions: "Ubah hak akses", decide_loan: "Putuskan pinjaman",
};
