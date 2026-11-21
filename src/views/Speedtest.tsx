import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Card } from "../components/Card";
import { SpeedGauge } from "../components/SpeedGauge";
import { useT } from "../lib/i18n";
import { useSpeedtest, type HistoryEntry, type SpeedState, type TestKind } from "../lib/speedtest";

const DOWN: [string, string] = ["var(--color-cpu)", "var(--color-cpu-2)"];
const UP: [string, string] = ["var(--color-gpu)", "var(--color-gpu-2)"];

const KINDS: TestKind[] = ["full", "download", "upload"];
const DURATIONS = [5, 10, 15];

/**
 * Vista "Speedtest": prueba de velocidad de internet.
 * El estado vive en App (useSpeedtest) para que la prueba siga si cambias de pestaña.
 */
export function Speedtest({ speed }: { speed: ReturnType<typeof useSpeedtest> }) {
  const { state: s, history, start, cancel, clearHistory } = speed;
  const { t } = useT();
  const sp = t.speed;
  const [kind, setKind] = useState<TestKind>("full");
  const [seconds, setSeconds] = useState(10);
  const [showIp, setShowIp] = useState(false);

  const uploading = s.phase === "upload";
  const gaugeValue = s.phase === "download" || s.phase === "upload" ? s.live
    : s.phase === "done" ? (s.download ?? s.upload ?? 0) : 0;
  const colors = uploading || (s.phase === "done" && s.download == null) ? UP : DOWN;
  const go = () => start({ kind, seconds });

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* ---------------- Velocímetro ---------------- */}
      <Card title={sp.title} subtitle={s.meta?.server ? sp.server(s.meta.server) : "Cloudflare"}
        accent={uploading ? "var(--color-gpu)" : "var(--color-cpu)"} className="col-span-12 lg:col-span-8">
        <div className="relative">
          <SpeedGauge value={gaugeValue} colors={colors} showNeedle={s.phase !== "idle"}>
            {s.phase !== "idle" && <GaugeCenter s={s} />}
          </SpeedGauge>

          {/* Botón de inicio en el centro del velocímetro */}
          <AnimatePresence>
            {!s.running && (s.phase === "idle" || s.phase === "error") && (
              <motion.div className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
                <button onClick={go}
                  className="group relative flex h-36 w-36 items-center justify-center rounded-[var(--radius-pill)] font-display text-2xl font-semibold tracking-[0.2em] text-fg">
                  <span className="absolute inset-0 rounded-[var(--radius-pill)] border-2 transition group-hover:scale-105"
                    style={{ borderColor: "var(--color-cpu)", boxShadow: "0 0 calc(40px * var(--glow)) -6px var(--color-cpu), inset 0 0 calc(30px * var(--glow)) -10px var(--color-cpu)" }} />
                  <span className="pulse-ring absolute inset-0 rounded-[var(--radius-pill)] border" style={{ borderColor: "var(--color-cpu)" }} />
                  <span className="relative">{sp.start}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pasos + controles */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <Steps s={s} kind={kind} />
          {s.running ? (
            <button onClick={cancel}
              className="rounded-[var(--radius-pill)] border border-line px-4 py-1.5 text-sm text-muted transition hover:bg-tint-2 hover:text-fg">
              {sp.cancel}
            </button>
          ) : s.phase === "done" ? (
            <button onClick={go}
              className="rounded-[var(--radius-pill)] px-5 py-1.5 text-sm font-medium text-[color:var(--color-bg)] transition hover:brightness-110"
              style={{ background: "linear-gradient(135deg, var(--color-cpu), var(--color-gpu))" }}>
              {sp.repeat}
            </button>
          ) : null}
        </div>
        {s.phase === "error" && (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hot)]/30 bg-[color:var(--color-hot)]/10 px-3 py-2 text-sm text-fg">
            {sp.errorPrefix} {s.error}
          </p>
        )}
      </Card>

      {/* ---------------- Menú de la prueba ---------------- */}
      <Card title={sp.test} accent="var(--color-net)" className="col-span-12 lg:col-span-4" delay={0.05}>
        <Label>{sp.testType}</Label>
        <div className="flex flex-col gap-2">
          {KINDS.map((k) => (
            <button key={k} disabled={s.running} onClick={() => setKind(k)}
              className={`flex items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                kind === k ? "border-[color:var(--color-net)]/60 bg-tint-2" : "border-line hover:bg-tint"}`}>
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                style={{ borderColor: kind === k ? "var(--color-net)" : "var(--color-muted)" }}>
                {kind === k && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-net)" }} />}
              </span>
              <span>
                <span className="block text-sm text-fg">{sp.kinds[k][0]}</span>
                <span className="block text-xs text-muted">{sp.kinds[k][1]}</span>
              </span>
            </button>
          ))}
        </div>

        <Label className="mt-5">{sp.duration}</Label>
        <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-sm)] border border-line bg-tint p-1">
          {DURATIONS.map((d, i) => (
            <button key={d} disabled={s.running} onClick={() => setSeconds(d)}
              className={`relative rounded-[calc(var(--radius-sm)-4px)] py-1.5 text-center transition disabled:opacity-50 ${
                seconds === d ? "text-fg" : "text-muted hover:text-fg"}`}>
              {seconds === d && (
                <motion.span layoutId="dur-pill" className="absolute inset-0 rounded-[calc(var(--radius-sm)-4px)] bg-tint-2"
                  style={{ boxShadow: "0 0 0 1px var(--color-line) inset" }} />
              )}
              <span className="relative block text-sm">{sp.durations[i]}</span>
              <span className="relative block text-[11px] text-muted">{d} s</span>
            </button>
          ))}
        </div>

        <Label className="mt-5">{sp.connection}</Label>
        <dl className="flex flex-col divide-y divide-line text-sm">
          <Row k={sp.isp} v={s.meta?.isp ?? history[0]?.isp ?? "—"} />
          <Row k={sp.serverLabel} v={s.meta?.server ? `${s.meta.server}${s.meta.serverCode ? ` (${s.meta.serverCode})` : ""}` : history[0]?.server ?? "—"} />
          <Row k={sp.location} v={s.meta?.city ? `${s.meta.city}, ${s.meta.country}` : "—"} />
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-muted">{sp.publicIp}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span className={`truncate font-mono text-xs text-fg transition ${showIp ? "" : "blur-[5px]"}`}>{s.meta?.ip ?? "—"}</span>
              {s.meta?.ip && (
                <button onClick={() => setShowIp((v) => !v)} className="shrink-0 text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
                  {showIp ? sp.hide : sp.show}
                </button>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      {/* ---------------- Resultados ---------------- */}
      <div className="col-span-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Result label={sp.ping} unit="ms" value={s.ping ?? (s.phase === "ping" ? s.live : null)} active={s.phase === "ping"} color="var(--color-net)" icon="ping" />
        <Result label={sp.jitter} unit="ms" value={s.jitter} active={false} color="var(--color-fan)" icon="jitter" digits={1} />
        <Result label={sp.download} unit="Mb/s" value={s.download ?? (s.phase === "download" ? s.live : null)} active={s.phase === "download"} color="var(--color-cpu)" icon="down" />
        <Result label={sp.upload} unit="Mb/s" value={s.upload ?? (s.phase === "upload" ? s.live : null)} active={s.phase === "upload"} color="var(--color-gpu)" icon="up" />
      </div>

      {/* ---------------- Para qué alcanza ---------------- */}
      <Card title={sp.usesTitle} accent="var(--color-ok)" className="col-span-12 lg:col-span-5" delay={0.1}>
        <Uses s={s} last={history[0]} />
      </Card>

      {/* ---------------- Historial ---------------- */}
      <Card title={sp.history} subtitle={history.length ? sp.historyCount(history.length) : undefined}
        accent="var(--color-disk)" className="col-span-12 lg:col-span-7" delay={0.15}>
        <HistoryTable history={history} onClear={clearHistory} />
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ piezas

function GaugeCenter({ s }: { s: SpeedState }) {
  const { t } = useT();
  const phaseLabel: Record<string, string> = { meta: t.speed.finding, ping: t.speed.measuring, download: t.speed.download, upload: t.speed.upload };
  const isPing = s.phase === "ping" || s.phase === "meta";
  const value = s.phase === "done" ? (s.download ?? s.upload ?? 0) : s.live;
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-5xl font-semibold tabular-nums text-fg">
        {s.phase === "meta" ? "—" : <AnimatedNumber value={value} digits={isPing || value >= 100 ? 0 : 1} />}
      </span>
      <span className="text-sm text-muted">{isPing ? "ms" : "Mb/s"}</span>
      <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted">
        {s.phase === "done" ? (s.download != null ? t.speed.download : t.speed.upload) : phaseLabel[s.phase] ?? ""}
      </span>
    </div>
  );
}

function Steps({ s, kind }: { s: SpeedState; kind: TestKind }) {
  const { t } = useT();
  const steps = [
    { id: "ping", label: t.speed.ping, done: s.ping != null },
    ...(kind !== "upload" ? [{ id: "download", label: t.speed.download, done: s.download != null }] : []),
    ...(kind !== "download" ? [{ id: "upload", label: t.speed.upload, done: s.upload != null }] : []),
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((st, i) => {
        const active = s.running && (s.phase === st.id || (st.id === "ping" && s.phase === "meta"));
        return (
          <div key={st.id} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-[color:var(--color-line)]" />}
            <span className={`flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs transition ${
              active ? "bg-tint-2 text-fg" : st.done ? "text-fg" : "text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "pulse" : ""}`}
                style={{ background: st.done ? "var(--color-ok)" : active ? "var(--color-cpu)" : "var(--color-muted)" }} />
              {st.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Result({ label, unit, value, active, color, icon, digits }: {
  label: string; unit: string; value: number | null; active: boolean; color: string;
  icon: "ping" | "jitter" | "down" | "up"; digits?: number;
}) {
  const d = digits ?? (value != null && value < 100 && unit === "Mb/s" ? 1 : 0);
  return (
    <motion.div className="card relative overflow-hidden rounded-[var(--radius)] p-4"
      style={{ "--accent": color, borderColor: active ? color : undefined } as React.CSSProperties}
      animate={{ scale: active ? 1.02 : 1 }}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        <Icon kind={icon} color={color} />
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-3xl font-semibold tabular-nums" style={{ color: value != null ? "var(--color-fg)" : "var(--color-muted)" }}>
          {value != null ? <AnimatedNumber value={value} digits={d} /> : "—"}
        </span>
        <span className="text-sm text-muted">{unit}</span>
      </div>
      {active && <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />}
    </motion.div>
  );
}

function Uses({ s, last }: { s: SpeedState; last?: HistoryEntry }) {
  const { t } = useT();
  const uses = t.speed.uses;
  const src = s.phase === "done" ? s : last;
  if (!src || (src.download == null && src.upload == null)) {
    return <p className="text-sm text-muted">{t.speed.usesEmpty}</p>;
  }
  const d = src.download ?? 0, u = src.upload ?? 0, p = src.ping ?? 999, j = src.jitter ?? 99;
  const items: [string, boolean | null][] = [
    [uses[0], src.download != null ? d >= 5 : null],
    [uses[1], src.download != null ? d >= 25 : null],
    [uses[2], src.download != null && src.upload != null ? d >= 10 && u >= 5 : null],
    [uses[3], p < 50 && j < 15],
    [uses[4], src.upload != null ? u >= 10 : null],
    [uses[5], src.download != null ? d >= 200 : null],
  ];
  return (
    <ul className="flex flex-col gap-2.5">
      {items.filter(([, ok]) => ok !== null).map(([label, ok]) => (
        <li key={label} className="flex items-center gap-3 text-sm">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: `color-mix(in oklab, ${ok ? "var(--color-ok)" : "var(--color-hot)"} 18%, transparent)` }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ok ? "var(--color-ok)" : "var(--color-hot)"} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              {ok ? <path d="M5 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
            </svg>
          </span>
          <span className={ok ? "text-fg" : "text-muted"}>{label}</span>
        </li>
      ))}
    </ul>
  );
}

function HistoryTable({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) {
  const { t, lang } = useT();
  if (!history.length) return <p className="text-sm text-muted">{t.speed.historyEmpty}</p>;
  const fmt = (v: number | null, d = 0) => (v == null ? "—" : v.toFixed(d));
  return (
    <>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 text-left text-[11px] uppercase tracking-wider text-muted" style={{ background: "var(--color-bg)" }}>
            <tr>
              <th className="py-2 font-medium">{t.speed.date}</th>
              <th className="py-2 text-right font-medium">{t.speed.ping}</th>
              <th className="py-2 text-right font-medium">{t.speed.download}</th>
              <th className="py-2 text-right font-medium">{t.speed.upload}</th>
              <th className="hidden py-2 pl-4 font-medium md:table-cell">{t.speed.serverLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {history.map((h) => (
              <tr key={h.date} className="tabular-nums">
                <td className="py-2 text-muted">
                  {new Date(h.date).toLocaleString(lang, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-2 text-right text-fg">{fmt(h.ping)} <span className="text-xs text-muted">ms</span></td>
                <td className="py-2 text-right" style={{ color: "var(--color-cpu)" }}>{fmt(h.download, 1)} <span className="text-xs text-muted">Mb/s</span></td>
                <td className="py-2 text-right" style={{ color: "var(--color-gpu)" }}>{fmt(h.upload, 1)} <span className="text-xs text-muted">Mb/s</span></td>
                <td className="hidden truncate py-2 pl-4 text-muted md:table-cell">{h.server ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onClear} className="mt-3 text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
        {t.speed.clear}
      </button>
    </>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted ${className}`}>{children}</div>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className="truncate text-right text-fg" title={v}>{v}</dd>
    </div>
  );
}

function Icon({ kind, color }: { kind: "ping" | "jitter" | "down" | "up"; color: string }) {
  const p = {
    ping: <path d="M2 12h4l3-8 6 16 3-8h4" />,
    jitter: <path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" />,
    down: <path d="M12 4v14M6 12l6 6 6-6" />,
    up: <path d="M12 20V6M6 12l6-6 6 6" />,
  }[kind];
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
  );
}
