import { useEffect, useRef, useState } from "react";
import type { History, Snapshot } from "./types";
import { demoSnapshot } from "./demo";

const HISTORY_LEN = 60; // segundos de historial en las gráficas

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const emptyHistory = (): History => ({
  cpuLoad: [], cpuTemp: [], gpuLoad: [], gpuTemp: [], ramLoad: [], netUp: [], netDown: [],
});

const push = (arr: number[], v: number | null | undefined) =>
  [...arr, v ?? 0].slice(-HISTORY_LEN);

/**
 * Datos de sensores en vivo. Dentro de Tauri escucha el evento `sensors`
 * que emite el backend Rust; en el navegador genera datos de demostración
 * para poder trabajar en el diseño sin compilar la app.
 */
export function useSensors() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<History>(emptyHistory);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    const onSnapshot = (s: Snapshot) => {
      lastRef.current = s;
      setData(s);
      setError(null);
      setHistory((h) => ({
        cpuLoad: push(h.cpuLoad, s.cpu?.load),
        cpuTemp: push(h.cpuTemp, s.cpu?.temp),
        gpuLoad: push(h.gpuLoad, s.gpu?.load),
        gpuTemp: push(h.gpuTemp, s.gpu?.temp),
        ramLoad: push(h.ramLoad, s.ram?.load),
        netUp: push(h.netUp, s.net?.up),
        netDown: push(h.netDown, s.net?.down),
      }));
    };

    if (!isTauri) {
      const id = setInterval(() => onSnapshot(demoSnapshot(lastRef.current)), 1000);
      onSnapshot(demoSnapshot(null));
      return () => clearInterval(id);
    }

    let unlisten: (() => void)[] = [];
    let cancelled = false;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const a = await listen<string>("sensors", (e) => {
        try {
          onSnapshot(JSON.parse(e.payload) as Snapshot);
        } catch {
          /* línea incompleta: se ignora */
        }
      });
      const b = await listen<string>("sensors-error", (e) => setError(e.payload));
      if (cancelled) { a(); b(); } else unlisten = [a, b];
    })();
    return () => {
      cancelled = true;
      unlisten.forEach((u) => u());
    };
  }, []);

  return { data, history, error, live: isTauri };
}
