import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cx } from "./cx";

/**
 * Design system: Table/Header (bg/canvas, radius 8, tinggi 36, 11 Bold huruf besar +0,5px)
 *                Table/Row (tinggi 58, garis line/subtle, isi 13)
 */
export type Column<T> = {
  key: string;
  header: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  render: (row: T, i: number) => React.ReactNode;
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty = "Belum ada data",
  rowHeight = "h-[58px]",
  onRowClick,
  selectedKey,
  expandedKey,
  renderExpanded,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: string;
  rowHeight?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  /** baris yang sedang terbuka: isinya (renderExpanded) tampil tepat di bawah barisnya */
  expandedKey?: string | number | null;
  renderExpanded?: (row: T) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-body-sm">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c.key}
                className={cx(
                  "h-9 bg-canvas px-4 text-caption font-bold uppercase tracking-[0.5px] text-fg-muted whitespace-nowrap",
                  c.align === "right" ? "text-right" : "text-left",
                  i === 0 && "rounded-l-chip",
                  i === columns.length - 1 && "rounded-r-chip",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="h-24 text-center text-body-sm text-fg-subtle">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, ri) => (
            <Fragment key={rowKey(r)}>
              <tr
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cx(onRowClick && "cursor-pointer hover:bg-canvas/60", selectedKey === rowKey(r) && "bg-canvas")}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      rowHeight,
                      "px-4 text-fg",
                      ri < rows.length - 1 && !(renderExpanded && expandedKey === rowKey(r)) && "border-b border-line-subtle",
                      c.align === "right" ? "text-right" : "text-left",
                      c.className,
                    )}
                  >
                    {c.render(r, ri)}
                  </td>
                ))}
              </tr>
              {renderExpanded && expandedKey === rowKey(r) && (
                <tr>
                  <td colSpan={columns.length} className={cx("bg-canvas/60 px-4 py-4", ri < rows.length - 1 && "border-b border-line-subtle")}>
                    {renderExpanded(r)}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sel dua baris: nama tebal + keterangan kecil */
export function CellStack({ title, sub, avatar }: { title: React.ReactNode; sub?: React.ReactNode; avatar?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {avatar}
      <div className="min-w-0">
        <div className="font-bold text-fg truncate">{title}</div>
        {sub && <div className="text-caption text-fg-subtle truncate">{sub}</div>}
      </div>
    </div>
  );
}

/** Pager: tombol 32×32 radius 8 */
export function Pager({ page, total, limit, onPage, label }: { page: number; total: number; limit: number; onPage: (p: number) => void; label: string }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))).sort((a, b) => a - b);
  const btn = "flex size-8 items-center justify-center rounded-chip text-small font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default";
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <span className="text-body-sm text-fg-muted">
        Menampilkan {from}–{Math.min(page * limit, total)} dari {total} {label}
      </span>
      <div className="flex items-center gap-1.5">
        <button className={cx(btn, "border border-line bg-card text-fg")} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Sebelumnya">
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-fg-subtle">…</span>}
            <button className={cx(btn, n === page ? "bg-inverse text-accent" : "border border-line bg-card text-fg")} onClick={() => onPage(n)}>
              {n}
            </button>
          </span>
        ))}
        <button className={cx(btn, "border border-line bg-card text-fg")} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Berikutnya">
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
