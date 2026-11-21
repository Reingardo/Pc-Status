import { AnimatePresence, motion } from "motion/react";
import { Card } from "../components/Card";
import { RECOMMENDED, type AlertKind, type AlertsApi } from "../lib/alerts";
import { useT } from "../lib/i18n";

const KIND_COLOR: Record<AlertKind, string> = {
  cpu: "var(--color-cpu)",
  gpu: "var(--color-gpu)",
  disk: "var(--color-disk)",
};
const RANGES: Record<AlertKind, [number, number]> = { cpu: [60, 100], gpu: [60, 100], disk: [40, 85] };

/** Vista "Alertas": historial de temperaturas altas y límites configurables. */
export function Alerts({ api }: { api: AlertsApi }) {
  const { t, lang } = useT();
  const a = t.alerts;
  const { alerts, config, unread } = api;

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* ---------------- Historial ---------------- */}
      <Card title={a.history} subtitle={unread ? a.unread(unread) : undefined} accent="var(--color-hot)"
        className="col-span-12 lg:col-span-8">
        {alerts.length > 0 && (
          <div className="-mt-1 mb-3 flex justify-end gap-2">
            <SmallButton onClick={api.markAllRead} disabled={!unread}>{a.markAll}</SmallButton>
            <SmallButton onClick={api.clear}>{a.clear}</SmallButton>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "color-mix(in oklab, var(--color-ok) 15%, transparent)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <p className="text-sm text-muted">{a.empty}</p>
          </div>
        ) : (
          <ul className="flex max-h-[520px] flex-col divide-y divide-line overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {alerts.map((al) => (
                <motion.li key={al.id} layout
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}
                  onClick={() => !al.read && api.markRead(al.id)}
                  className={`flex items-center gap-3 py-3 ${al.read ? "" : "cursor-pointer"}`}>
                  {/* Punto rojo al inicio: alerta sin leer */}
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${al.read ? "" : "pulse"}`}
                    style={al.read
                      ? { background: "var(--color-track)" }
                      : { background: "var(--color-hot)", boxShadow: "0 0 10px var(--color-hot)" }} />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
                    style={{ background: `color-mix(in oklab, ${KIND_COLOR[al.kind]} 15%, transparent)` }}>
                    <Thermo color={KIND_COLOR[al.kind]} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm ${al.read ? "text-muted" : "font-medium text-fg"}`}>
                      {a.itemTitle(a[al.kind], al.value)}
                    </div>
                    <div className="truncate text-xs text-muted" title={al.name}>{a.itemDetail(al.limit, al.name)}</div>
                  </div>
                  <time className="shrink-0 text-xs tabular-nums text-muted">
                    {new Date(al.time).toLocaleString(lang, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </time>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      {/* ---------------- Límites ---------------- */}
      <Card title={a.limits} accent="var(--color-warn)" className="col-span-12 lg:col-span-4" delay={0.05}>
        <ToggleRow label={a.enabled} checked={config.enabled} onChange={(v) => api.updateConfig({ enabled: v })} />
        <ToggleRow label={a.notify} desc={a.notifyDesc} checked={config.notify} onChange={(v) => api.updateConfig({ notify: v })} />

        <div className={`mt-5 flex flex-col gap-5 transition-opacity ${config.enabled ? "" : "pointer-events-none opacity-40"}`}>
          {(["cpu", "gpu", "disk"] as AlertKind[]).map((k) => (
            <label key={k} className="block">
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-2 text-fg">
                  <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
                  {a[k]}
                </span>
                <span className="font-display text-base tabular-nums" style={{ color: KIND_COLOR[k] }}>{config[k]} °C</span>
              </div>
              <input type="range" min={RANGES[k][0]} max={RANGES[k][1]} step={1} value={config[k]}
                onChange={(e) => api.updateConfig({ [k]: Number(e.target.value) })}
                className="w-full" style={{ accentColor: KIND_COLOR[k] }} />
              <div className="text-[11px] text-muted">{a.recommended(RECOMMENDED[k])}</div>
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button onClick={api.test}
            className="rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium text-[color:var(--color-bg)] transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg, var(--color-warn), var(--color-hot))" }}>
            {a.test}
          </button>
          <SmallButton onClick={api.resetLimits}>{a.reset}</SmallButton>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">{a.info}</p>
      </Card>
    </div>
  );
}

function SmallButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="rounded-[var(--radius-pill)] border border-line px-3 py-1 text-xs text-muted transition hover:bg-tint-2 hover:text-fg disabled:opacity-40">
      {children}
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div>
        <div className="text-sm text-fg">{label}</div>
        {desc && <div className="text-xs text-muted">{desc}</div>}
      </div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className="relative h-6 w-11 shrink-0 rounded-[var(--radius-pill)] transition-colors"
        style={{ background: checked ? "var(--color-ok)" : "var(--color-track)" }}>
        <motion.span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-[var(--radius-pill)] bg-white shadow"
          animate={{ x: checked ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
      </button>
    </div>
  );
}

function Thermo({ color }: { color: string }) {
  return (
    <svg width="14" height="18" viewBox="0 0 10 16" fill={color}>
      <path d="M5 0a2.5 2.5 0 0 0-2.5 2.5v7.1a4 4 0 1 0 5 0V2.5A2.5 2.5 0 0 0 5 0Z" />
    </svg>
  );
}
