import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { LANGS, useT } from "../lib/i18n";
import { DEFAULT_SETTINGS, THEMES, type Settings, type Theme } from "../lib/themes";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
}

/** Panel lateral de ajustes: elección de tema y personalización. */
export function SettingsPanel({ open, onClose, settings, onChange }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { t } = useT();
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside role="dialog" aria-label={t.settings.title}
            className="fixed top-0 right-0 bottom-0 z-50 flex w-[400px] max-w-full flex-col border-l border-line shadow-2xl"
            style={{ background: "var(--color-bg)" }}
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}>
            <header className="flex items-center justify-between px-6 pt-5 pb-4">
              <h2 className="font-display text-xl font-semibold text-fg">{t.settings.title}</h2>
              <button onClick={onClose} aria-label={t.settings.close}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-pill)] text-muted transition hover:bg-tint-2 hover:text-fg">
                <svg width="12" height="12" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <Section title={t.settings.language}>
                <div className="grid grid-cols-3 gap-1.5">
                  {LANGS.map((l) => (
                    <button key={l.id} onClick={() => set({ lang: l.id })} aria-pressed={settings.lang === l.id}
                      className={`rounded-[var(--radius-sm)] border px-2 py-2 text-sm transition ${
                        settings.lang === l.id ? "border-[color:var(--color-cpu)] bg-tint-2 text-fg" : "border-line text-muted hover:bg-tint hover:text-fg"}`}>
                      {l.name}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title={t.settings.theme}>
                <div className="grid grid-cols-2 gap-3">
                  {THEMES.map((t) => (
                    <ThemeCard key={t.id} theme={t} active={settings.theme === t.id} onClick={() => set({ theme: t.id })} />
                  ))}
                </div>
              </Section>

              <Section title={t.settings.customize}>
                <label className="block">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-fg">{t.settings.glow}</span>
                    <span className="tabular-nums text-muted">{Math.round(settings.glow * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={2} step={0.05} value={settings.glow}
                    onChange={(e) => set({ glow: Number(e.target.value) })}
                    className="w-full accent-[var(--color-cpu)]" />
                </label>

                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-fg">{t.settings.animations}</div>
                    <div className="text-xs text-muted">{t.settings.animationsDesc}</div>
                  </div>
                  <Toggle checked={settings.animations} onChange={(v) => set({ animations: v })} />
                </div>

                <button onClick={() => onChange({ ...DEFAULT_SETTINGS, lang: settings.lang })}
                  className="mt-6 w-full rounded-[var(--radius-sm)] border border-line px-4 py-2 text-sm text-muted transition hover:bg-tint hover:text-fg">
                  {t.settings.reset}
                </button>
              </Section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-2 mb-6">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** Miniatura del tema dibujada con SUS colores, fuente y esquinas. */
function ThemeCard({ theme, active, onClick }: { theme: Theme; active: boolean; onClick: () => void }) {
  const { t } = useT();
  const [name, description] = t.themes[theme.id] ?? [theme.name, theme.description];
  const v = theme.vars;
  const r = parseInt(v["--radius"]);
  const accents = [v["--color-cpu"], v["--color-gpu"], v["--color-ram"]];
  return (
    <button onClick={onClick} aria-pressed={active}
      className="group text-left">
      <div className="relative overflow-hidden p-2.5 transition"
        style={{
          background: v["--color-bg"],
          borderRadius: Math.min(r, 14),
          outline: active ? `2px solid ${v["--color-cpu"]}` : "1px solid var(--color-line)",
          outlineOffset: active ? 2 : 0,
        }}>
        {/* fondo con brillo del tema */}
        <div className="pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full blur-xl"
          style={{ background: accents[1], opacity: 0.25 * Math.min(1, Number(v["--glow"])) }} />
        <div className="relative flex gap-1.5">
          {accents.map((c, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1 p-1.5"
              style={{
                background: v["--card-bg"],
                border: `1px solid ${v["--card-border"]}`,
                borderRadius: Math.min(r, 10) / 1.5,
              }}>
              <MiniGauge color={c} track={v["--color-track"]} pct={[0.62, 0.45, 0.78][i]} />
            </div>
          ))}
        </div>
        <div className="relative mt-1.5 flex gap-1">
          {[0.5, 0.8, 0.35, 0.65, 0.9, 0.4].map((h, i) => (
            <div key={i} className="h-5 flex-1 overflow-hidden" style={{ background: v["--color-track"], borderRadius: Math.min(r, 4) / 2 }}>
              <div style={{ height: "100%", transform: `scaleY(${h})`, transformOrigin: "bottom", background: v["--color-cpu"] }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-sm font-medium text-fg" style={{ fontFamily: v["--font-display"] }}>{name}</span>
        {active && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ok)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </div>
      <p className="text-xs leading-snug text-muted">{description}</p>
    </button>
  );
}

function MiniGauge({ color, track, pct }: { color: string; track: string; pct: number }) {
  const r = 9, c = 2 * Math.PI * r, arc = c * 0.75;
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" style={{ transform: "rotate(135deg)" }}>
      <circle cx="12" cy="12" r={r} fill="none" stroke={track} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
      <circle cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${arc * pct} ${c}`} />
    </svg>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-[var(--radius-pill)] transition-colors"
      style={{ background: checked ? "var(--color-cpu)" : "var(--color-track)" }}>
      <motion.span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-[var(--radius-pill)] bg-white shadow"
        animate={{ x: checked ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
    </button>
  );
}
