import { motion } from "motion/react";
import { useState } from "react";
import type { Snapshot } from "../lib/types";
import { useT } from "../lib/i18n";
import { isTauri } from "../lib/useSensors";

/**
 * Avisos de la parte superior: error del sidecar, falta de permisos de
 * administrador o falta del driver PawnIO (con botón para instalarlo).
 */
export function Notices({ data, error }: { data: Snapshot | null; error: string | null }) {
  const { t } = useT();
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const missingPawnIo = data?.pawnIo && !data.pawnIo.installed;

  const install = async () => {
    setInstalling(true);
    setResult(null);
    try {
      if (isTauri) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("install_pawnio");
      } else {
        await new Promise((r) => setTimeout(r, 1500)); // demo
      }
      setResult("ok");
    } catch (e) {
      setResult(t.notices.pawnFailed);
    } finally {
      setInstalling(false);
    }
  };

  if (error) return <Box tone="hot">{t.notices.sensorsStopped}</Box>;
  if (!data) return null;

  if (missingPawnIo && result !== "ok") {
    return (
      <Box tone="warn">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-fg">{t.notices.pawnTitle}</div>
            <div className="text-muted">{t.notices.pawnBody}</div>
            {result && <div className="mt-1 text-[color:var(--color-hot)]">{result}</div>}
          </div>
          <button onClick={install} disabled={installing}
            className="shrink-0 rounded-[var(--radius-pill)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-bg)] transition hover:brightness-110 disabled:opacity-60"
            style={{ background: "var(--color-warn)" }}>
            {installing ? t.notices.pawnInstalling : t.notices.pawnInstall}
          </button>
        </div>
      </Box>
    );
  }

  if (result === "ok") {
    return <Box tone="ok">{t.notices.pawnDone}</Box>;
  }

  if (!data.admin) {
    return <Box tone="warn">{t.notices.needAdmin}</Box>;
  }
  return null;
}

function Box({ tone, children }: { tone: "warn" | "hot" | "ok"; children: React.ReactNode }) {
  const c = `var(--color-${tone})`;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-[var(--radius-sm)] border px-4 py-2.5 text-sm text-fg"
      style={{ borderColor: `color-mix(in oklab, ${c} 35%, transparent)`, background: `color-mix(in oklab, ${c} 10%, transparent)` }}>
      {children}
    </motion.div>
  );
}
