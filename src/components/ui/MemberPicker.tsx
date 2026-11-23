"use client";
import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { qs, useApi, useDebounced } from "@/lib/api";
import { cx } from "./cx";

export type MemberOption = { id: number; name: string; member_number: string; national_id: string | null; region_name: string };

const label = (m: MemberOption) => `${m.name} · ${m.member_number}${m.national_id ? ` · NIK ${m.national_id}` : ""} · ${m.region_name}`;

/** Pilih anggota dengan pencarian (nama, no. anggota, NIK, no. HP) — pencarian dilakukan di server. */
export function MemberPicker({ value, onChange, invalid }: { value: MemberOption | null; onChange: (m: MemberOption) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const search = useDebounced(text.trim());
  const { data, error } = useApi<MemberOption[]>(open ? `/api/v1/anggota${qs({ q: search || undefined, limit: 20 })}` : null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cx("flex h-[52px] w-full cursor-pointer items-center justify-between gap-2 rounded-ctl border-[1.5px] bg-card px-4 text-left text-body outline-none focus:border-fg", invalid ? "border-warn-text" : "border-line", !value && "text-fg-subtle")}
      >
        <span className="truncate">{value ? label(value) : "Pilih anggota…"}</span>
        <ChevronDown size={16} strokeWidth={1.5} className="shrink-0 text-fg-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.preventDefault(); setOpen(false); }} /> {/* preventDefault: picker berada di dalam <label> Field, tanpa ini klik diteruskan ke tombol dan membuka ulang */}
          <div className="absolute top-full right-0 left-0 z-40 mt-1 flex flex-col gap-2 rounded-ctl border border-line bg-card p-2 shadow-lg">
            <label className="flex h-10 items-center gap-2.5 rounded-ctl border border-line px-3">
              <Search size={16} strokeWidth={1.5} className="shrink-0 text-fg-muted" />
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                placeholder="Cari nama, no. anggota, atau NIK…"
                className="w-full bg-transparent text-body-sm text-fg outline-none placeholder:text-fg-subtle"
              />
            </label>
            <ul className="max-h-[280px] overflow-y-auto">
              {error && <li className="px-3 py-2 text-small text-warn-text">{error}</li>}
              {!data && !error && <li className="px-3 py-2 text-small text-fg-subtle">Memuat…</li>}
              {data?.length === 0 && <li className="px-3 py-2 text-small text-fg-subtle">Anggota tidak ditemukan</li>}
              {data?.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(m); setOpen(false); setText(""); }}
                    className={cx("flex w-full cursor-pointer flex-col rounded-ctl px-3 py-2 text-left hover:bg-canvas", value?.id === m.id && "bg-canvas")}
                  >
                    <span className="text-body-sm font-medium text-fg">{m.name}</span>
                    <span className="text-small text-fg-muted">{m.member_number}{m.national_id ? ` · NIK ${m.national_id}` : ""} · {m.region_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
