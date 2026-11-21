import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "./useSensors";

export type TestKind = "full" | "download" | "upload";
export type Phase = "idle" | "meta" | "ping" | "download" | "upload" | "done" | "error";

export interface SpeedOptions { kind: TestKind; seconds: number }

export interface SpeedState {
  phase: Phase;
  running: boolean;
  progress: number; // 0–1 de la fase actual
  live: number; // Mb/s instantáneos (o ms durante el ping)
  ping: number | null;
  jitter: number | null;
  download: number | null;
  upload: number | null;
  meta: { isp?: string; ip?: string; city?: string; country?: string; server?: string; serverCode?: string } | null;
  error: string | null;
}

export interface HistoryEntry {
  date: number;
  ping: number | null;
  jitter: number | null;
  download: number | null;
  upload: number | null;
  isp?: string;
  server?: string;
}

const INITIAL: SpeedState = {
  phase: "idle", running: false, progress: 0, live: 0,
  ping: null, jitter: null, download: null, upload: null, meta: null, error: null,
};

const HISTORY_KEY = "pcstatus.speedtests";
const loadHistory = (): HistoryEntry[] => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
};
const saveHistory = (h: HistoryEntry[]) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* sin almacenamiento */ }
};

type Event = Record<string, any> & { phase: string };

/** Estado de la prueba de velocidad + historial. */
export function useSpeedtest() {
  const [state, setState] = useState<SpeedState>(INITIAL);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const demoStop = useRef<(() => void) | null>(null);
  useEffect(() => saveHistory(history), [history]);

  const onEvent = useCallback((e: Event) => {
    // El historial se guarda fuera del actualizador de estado (que React puede ejecutar dos veces).
    if (e.phase === "done") {
      const entry: HistoryEntry = {
        date: Date.now(), ping: e.ping, jitter: e.jitter, download: e.download, upload: e.upload,
        isp: e.isp ?? undefined, server: e.server ?? undefined,
      };
      setHistory((h) => [entry, ...h].slice(0, 20));
    }
    setState((s): SpeedState => {
      switch (e.phase) {
        case "meta":
          return e.isp !== undefined
            ? { ...s, phase: "meta", meta: { isp: e.isp, ip: e.ip, city: e.city, country: e.country, server: e.server, serverCode: e.serverCode } }
            : { ...s, phase: "meta" };
        case "ping":
          return { ...s, phase: "ping", live: e.value, progress: e.progress };
        case "ping-done":
          return { ...s, ping: e.ping, jitter: e.jitter };
        case "download":
        case "upload":
          return { ...s, phase: e.phase, live: e.mbps, progress: e.progress };
        case "download-done":
          return { ...s, download: e.mbps, live: e.mbps };
        case "upload-done":
          return { ...s, upload: e.mbps, live: e.mbps };
        case "done":
          return { ...s, phase: "done", running: false, progress: 1 };
        case "error":
          return { ...s, phase: "error", running: false, error: e.message };
        case "cancelled":
          return { ...INITIAL, meta: s.meta };
        default:
          return s;
      }
    });
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    import("@tauri-apps/api/event").then(({ listen }) =>
      listen<Event>("speedtest", (ev) => onEvent(ev.payload)).then((u) => (cancelled ? u() : (off = u))));
    return () => { cancelled = true; off?.(); };
  }, [onEvent]);

  const start = useCallback(async (opt: SpeedOptions) => {
    setState({ ...INITIAL, running: true, phase: "meta" });
    const options = { download: opt.kind !== "upload", upload: opt.kind !== "download", seconds: opt.seconds };
    if (!isTauri) {
      demoStop.current = runDemo(options, onEvent);
      return;
    }
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      await invoke("start_speedtest", { options });
    } catch (err) {
      setState((s) => (s.phase === "error" ? s : { ...s, running: false, phase: "error", error: String(err) }));
    }
  }, [onEvent]);

  const cancel = useCallback(async () => {
    if (!isTauri) { demoStop.current?.(); onEvent({ phase: "cancelled" }); return; }
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("cancel_speedtest");
  }, [onEvent]);

  const clearHistory = useCallback(() => { setHistory([]); saveHistory([]); }, []);

  return { state, history, start, cancel, clearHistory };
}

// ------------------------------------------------------------- simulación

/** Prueba simulada para el modo demo del navegador. */
function runDemo(opt: { download: boolean; upload: boolean; seconds: number }, emit: (e: Event) => void) {
  const timers: number[] = [];
  let t = 0;
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, (t += ms)));
  const meta = { isp: "Demo ISP", ip: "203.0.113.42", city: "Ciudad Demo", country: "XX", server: "Servidor demo", serverCode: "DEM" };

  at(400, () => emit({ phase: "meta", ...meta }));
  const pings: number[] = [];
  for (let i = 0; i < 15; i++) {
    at(90, () => {
      const v = 18 + Math.random() * 6;
      pings.push(v);
      emit({ phase: "ping", value: v, progress: (i + 1) / 15 });
    });
  }
  const ping = () => pings.reduce((a, b) => a + b, 0) / pings.length;
  at(50, () => emit({ phase: "ping-done", ping: ping(), jitter: 1.8 }));

  const phase = (name: "download" | "upload", target: number) => {
    const steps = opt.seconds * 5;
    let v = 0;
    for (let i = 1; i <= steps; i++) {
      at(200, () => {
        v = v + (target - v) * 0.25 + (Math.random() - 0.5) * target * 0.08;
        emit({ phase: name, mbps: Math.max(0, v), progress: i / steps });
      });
    }
    at(50, () => emit({ phase: `${name}-done`, mbps: target }));
  };
  const down = 480 + Math.random() * 120;
  const up = 180 + Math.random() * 60;
  if (opt.download) phase("download", down);
  if (opt.upload) phase("upload", up);
  at(100, () => emit({
    phase: "done", ping: ping(), jitter: 1.8,
    download: opt.download ? down : null, upload: opt.upload ? up : null, isp: meta.isp, server: meta.server,
  }));

  return () => timers.forEach(clearTimeout);
}
