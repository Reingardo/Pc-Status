import { motion } from "motion/react";
import { useT } from "../lib/i18n";
import { isTauri } from "../lib/useSensors";

export type View = "dashboard" | "mypc" | "speedtest" | "alerts" | "processes";

const TABS: View[] = ["dashboard", "mypc", "processes", "speedtest", "alerts"];

async function win() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

/** Barra de título propia (la ventana no tiene bordes de Windows). */
export function TitleBar({ live, error, view, onView, onSettings, unreadAlerts = 0 }: {
  live: boolean; error: string | null; view: View; onView: (v: View) => void; onSettings: () => void;
  unreadAlerts?: number;
}) {
  const { t } = useT();
  const status = error ? { text: t.status.noSensors, color: "var(--color-hot)" }
    : live ? { text: t.status.live, color: "var(--color-ok)" }
    : { text: t.status.demo, color: "var(--color-warn)" };

  return (
    <div data-tauri-drag-region className="relative flex h-12 shrink-0 select-none items-center justify-between pl-5">
      {/* Pestañas centradas */}
      <nav className="absolute left-1/2 flex -translate-x-1/2 gap-1 rounded-[var(--radius-pill)] border border-line bg-tint p-1">
        {TABS.map((id) => (
          <button key={id} onClick={() => onView(id)}
            className={`relative rounded-[var(--radius-pill)] px-3.5 py-1 text-[13px] font-medium transition-colors ${
              view === id ? "text-fg" : "text-muted hover:text-fg"}`}>
            {view === id && (
              <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-[var(--radius-pill)]"
                style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--color-cpu) 30%, transparent), color-mix(in oklab, var(--color-gpu) 30%, transparent))",
                  boxShadow: "0 0 0 1px var(--color-line) inset" }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            <span className="relative flex items-center gap-1.5">
              {/* Punto rojo: hay alertas sin leer */}
              {id === "alerts" && unreadAlerts > 0 && (
                <span className="pulse h-2 w-2 rounded-full" title={t.alerts.unread(unreadAlerts)}
                  style={{ background: "var(--color-hot)", boxShadow: "0 0 8px var(--color-hot)" }} />
              )}
              {t.tabs[id]}
            </span>
          </button>
        ))}
      </nav>
      <div data-tauri-drag-region className="flex items-center gap-3">
        <Logo />
        <span data-tauri-drag-region className="font-display text-sm font-semibold tracking-[0.25em] text-fg">
          PC STATUS
        </span>
        <span className="ml-2 flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-tint px-2.5 py-1 text-[11px] text-muted"
          title={status.text}>
          <span className="pulse h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
          {/* En ventanas estrechas solo el punto, para no chocar con las pestañas */}
          <span className="hidden min-[1180px]:inline">{status.text}</span>
        </span>
      </div>
      <div className="flex h-full items-center">
        <button onClick={onSettings} aria-label={t.window.settings} title={t.window.settings}
          className="group mr-2 flex h-8 w-8 items-center justify-center rounded-[var(--radius-pill)] text-muted transition-colors hover:bg-tint-2 hover:text-fg">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform duration-500 group-hover:rotate-90">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      {isTauri && (
        <div className="flex h-full">
          <WinButton onClick={async () => (await win()).minimize()} label={t.window.minimize}>
            <path d="M1 5.5h9" />
          </WinButton>
          <WinButton onClick={async () => (await win()).toggleMaximize()} label={t.window.maximize}>
            <rect x="1.5" y="1.5" width="8" height="8" rx="1" />
          </WinButton>
          <WinButton onClick={async () => (await win()).close()} label={t.window.close} danger>
            <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" />
          </WinButton>
        </div>
      )}
      </div>
    </div>
  );
}

function WinButton({ children, onClick, label, danger }: {
  children: React.ReactNode; onClick: () => void; label: string; danger?: boolean;
}) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={`flex w-12 items-center justify-center text-muted transition-colors hover:text-fg ${
        danger ? "hover:bg-[#e81123] hover:text-white" : "hover:bg-tint-2"}`}>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
        {children}
      </svg>
    </button>
  );
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-cpu)" />
          <stop offset="100%" stopColor="var(--color-gpu)" />
        </linearGradient>
      </defs>
      <path d="M12 2a10 10 0 1 0 10 10" stroke="url(#logo)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 7a5 5 0 1 0 5 5" stroke="url(#logo)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
