import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { useT } from "../lib/i18n";
import { groupByName, useProcesses, type ProcGroup } from "../lib/processes";

type SortKey = "cpu" | "memory" | "disk" | "name";

const keyOf = (g: ProcGroup) => `${g.name.toLowerCase()}#${g.pids.length > 1 ? "g" : g.pids[0]}`;

const fmtMem = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`);
const fmtDisk = (b: number) =>
  b < 1024 ? "0 KB/s" : b < 1024 ** 2 ? `${(b / 1024).toFixed(0)} KB/s` : `${(b / 1024 ** 2).toFixed(1)} MB/s`;

/** Vista "Procesos": qué está consumiendo recursos y opción de finalizarlo. */
export function Processes() {
  const { t } = useT();
  const pr = t.procs;
  const { list, error, kill } = useProcesses();
  const [query, setQuery] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [sort, setSort] = useState<SortKey>("cpu");
  const [confirm, setConfirm] = useState<ProcGroup | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [frozen, setFrozen] = useState(false);
  const order = useRef<string[]>([]);

  const rows = useMemo(() => {
    if (!list) return [];
    const base: ProcGroup[] = grouped ? groupByName(list) : list.map(({ pid, ...p }) => ({ ...p, pids: [pid] }));
    const q = query.trim().toLowerCase();
    const filtered = q ? base.filter((p) => p.name.toLowerCase().includes(q) || p.pids.some((id) => String(id).includes(q))) : base;
    const cmp: Record<SortKey, (a: ProcGroup, b: ProcGroup) => number> = {
      cpu: (a, b) => b.cpu - a.cpu || b.memory - a.memory,
      memory: (a, b) => b.memory - a.memory,
      disk: (a, b) => b.disk - a.disk || b.cpu - a.cpu,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    const sorted = filtered.sort(cmp[sort]);
    // Con el ratón encima de la tabla se congela el orden (los valores siguen
    // actualizándose) para que una fila no se mueva justo al pulsar "Finalizar".
    if (frozen && order.current.length) {
      const pos = new Map(order.current.map((k, i) => [k, i]));
      sorted.sort((a, b) => (pos.get(keyOf(a)) ?? 1e9) - (pos.get(keyOf(b)) ?? 1e9));
    } else {
      order.current = sorted.map(keyOf);
    }
    return sorted.slice(0, 150);
  }, [list, grouped, query, sort, frozen]);

  // Escala de las barras: el máximo visible de cada columna
  const max = useMemo(() => ({
    cpu: Math.max(1, ...rows.map((r) => r.cpu)),
    memory: Math.max(1, ...rows.map((r) => r.memory)),
    disk: Math.max(1, ...rows.map((r) => r.disk)),
  }), [rows]);

  const doKill = async (g: ProcGroup) => {
    setConfirm(null);
    try {
      const n = await kill(g.pids);
      setToast({ ok: true, text: `${g.name} · ${pr.killed(n)}` });
    } catch (e) {
      setToast({ ok: false, text: `${pr.failed} ${String(e)}` });
    }
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="relative">
      <Card title={pr.title} subtitle={list ? pr.count(list.length) : undefined} accent="var(--color-cpu)">
        {/* Barra de herramientas */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <svg className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={pr.search}
              className="w-full rounded-[var(--radius-sm)] border border-line bg-tint py-2 pr-3 pl-9 text-sm text-fg outline-none placeholder:text-muted focus:border-[color:var(--color-cpu)]" />
          </div>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} style={{ accentColor: "var(--color-cpu)" }} />
            {pr.group}
          </label>
        </div>

        {error && <p className="mb-3 text-sm text-[color:var(--color-hot)]">{error}</p>}

        {/* Tabla */}
        <div className="overflow-hidden rounded-[var(--radius-sm)] border border-line">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_110px_96px] items-center gap-3 bg-tint px-3 py-2 text-[11px] uppercase tracking-wider text-muted">
            <SortHeader label={pr.name} k="name" sort={sort} setSort={setSort} />
            <SortHeader label="CPU" k="cpu" sort={sort} setSort={setSort} right />
            <SortHeader label="RAM" k="memory" sort={sort} setSort={setSort} right />
            <SortHeader label={pr.disk} k="disk" sort={sort} setSort={setSort} right />
            <span />
          </div>

          <div className="max-h-[calc(100vh-260px)] min-h-40 overflow-y-auto"
            onMouseEnter={() => setFrozen(true)} onMouseLeave={() => setFrozen(false)}>
            {!list && <div className="shimmer m-3 h-40 rounded-[var(--radius-sm)]" />}
            {list && rows.length === 0 && <p className="py-10 text-center text-sm text-muted">{pr.empty}</p>}
            {rows.map((r) => (
              <div key={keyOf(r)}
                className="group grid grid-cols-[minmax(0,1fr)_110px_110px_110px_96px] items-center gap-3 border-t border-line px-3 py-2 text-sm transition-colors hover:bg-tint">
                <div className="flex min-w-0 items-center gap-2.5">
                  <AppBadge name={r.name} />
                  <div className="min-w-0">
                    <div className="truncate text-fg" title={r.exe ?? r.name}>{r.name}</div>
                    <div className="truncate text-[11px] text-muted">
                      {r.pids.length > 1 ? `×${r.pids.length}` : `PID ${r.pids[0]}`}
                    </div>
                  </div>
                </div>
                <Metric value={`${r.cpu.toFixed(1)} %`} frac={r.cpu / max.cpu} color="var(--color-cpu)" hot={r.cpu > 25} />
                <Metric value={fmtMem(r.memory)} frac={r.memory / max.memory} color="var(--color-ram)" hot={r.memory > 2 * 1024 ** 3} />
                <Metric value={fmtDisk(r.disk)} frac={r.disk / max.disk} color="var(--color-disk)" hot={r.disk > 50 * 1024 ** 2} />
                <div className="flex justify-end">
                  {r.protected ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted" title={pr.protectedHint}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                      {pr.protected}
                    </span>
                  ) : (
                    <button onClick={() => setConfirm(r)}
                      className="rounded-[var(--radius-pill)] border border-[color:var(--color-hot)]/40 px-3 py-1 text-xs text-[color:var(--color-hot)] opacity-70 transition group-hover:opacity-100 hover:bg-[color:var(--color-hot)] hover:text-white">
                      {pr.end}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{pr.note}</p>
      </Card>

      {/* Confirmación */}
      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(null)}>
            <motion.div role="alertdialog" className="card w-full max-w-md rounded-[var(--radius)] p-6"
              style={{ background: "var(--color-bg)" }}
              initial={{ scale: 0.92, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in oklab, var(--color-hot) 18%, transparent)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-hot)" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M12 8v5M12 16.5v.5" /><path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                </span>
                <h3 className="font-display text-lg font-semibold text-fg">{pr.confirmTitle(confirm.name)}</h3>
              </div>
              <p className="text-sm text-muted">{confirm.pids.length > 1 ? pr.confirmMany(confirm.pids.length) : pr.confirmOne}</p>
              <div className="mt-6 flex justify-end gap-2">
                <button autoFocus onClick={() => setConfirm(null)}
                  className="rounded-[var(--radius-pill)] border border-line px-4 py-1.5 text-sm text-fg transition hover:bg-tint-2">
                  {pr.cancel}
                </button>
                <button onClick={() => doKill(confirm)}
                  className="rounded-[var(--radius-pill)] px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110"
                  style={{ background: "var(--color-hot)" }}>
                  {pr.end}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aviso del resultado */}
      <AnimatePresence>
        {toast && (
          <motion.div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[var(--radius-pill)] border px-4 py-2 text-sm text-fg shadow-xl"
            style={{
              background: "var(--color-bg)",
              borderColor: toast.ok ? "var(--color-ok)" : "var(--color-hot)",
            }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortHeader({ label, k, sort, setSort, right }: {
  label: string; k: SortKey; sort: SortKey; setSort: (k: SortKey) => void; right?: boolean;
}) {
  return (
    <button onClick={() => setSort(k)}
      className={`flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-fg ${right ? "justify-end" : ""} ${sort === k ? "text-fg" : ""}`}>
      {label}
      {sort === k && <span aria-hidden>▾</span>}
    </button>
  );
}

function Metric({ value, frac, color, hot }: { value: string; frac: number; color: string; hot: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="tabular-nums" style={{ color: hot ? "var(--color-hot)" : "var(--color-fg)" }}>{value}</span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-track)]">
        <div className="ml-auto h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, Math.min(100, frac * 100))}%`, background: color }} />
      </div>
    </div>
  );
}

/** Inicial de la app con un color estable según el nombre. */
function AppBadge({ name }: { name: string }) {
  const hues = ["var(--color-cpu)", "var(--color-gpu)", "var(--color-ram)", "var(--color-net)", "var(--color-disk)", "var(--color-fan)"];
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-xs)] font-display text-xs font-semibold"
      style={{ background: `color-mix(in oklab, ${hues[h]} 22%, transparent)`, color: hues[h] }}>
      {name.replace(/\.exe$/i, "").slice(0, 2).toUpperCase()}
    </span>
  );
}
