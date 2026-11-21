import { useCallback, useEffect, useRef, useState } from "react";
import type { Dict } from "./i18n";
import type { Snapshot } from "./types";
import { isTauri } from "./useSensors";

// Alertas de temperatura: si un componente supera su límite durante más de
// SUSTAIN_MS se guarda una alerta y se manda una notificación de Windows.
// No se repite hasta que la temperatura baja HYSTERESIS grados del límite.

export type AlertKind = "cpu" | "gpu" | "disk";

export interface AlertItem {
  id: string;
  time: number;
  kind: AlertKind;
  name: string;
  value: number;
  limit: number;
  read: boolean;
}

export interface AlertConfig {
  enabled: boolean;
  notify: boolean;
  cpu: number;
  gpu: number;
  disk: number;
}

/** Límites recomendados (°C): la mayoría de CPU/GPU bajan su velocidad cerca de 90–95 °C
 *  y los SSD NVMe se protegen sobre 70 °C. */
export const RECOMMENDED: Pick<AlertConfig, AlertKind> = { cpu: 85, gpu: 83, disk: 65 };
const DEFAULT_CONFIG: AlertConfig = { enabled: true, notify: true, ...RECOMMENDED };

const SUSTAIN_MS = 5000;
const HYSTERESIS = 3;
const MAX_ALERTS = 100;
const KEY_ALERTS = "pcstatus.alerts";
const KEY_CONFIG = "pcstatus.alertConfig";

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
};
const loadList = (): AlertItem[] => {
  try { return JSON.parse(localStorage.getItem(KEY_ALERTS) ?? "[]"); } catch { return []; }
};
const save = (key: string, v: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
};

/** Notificación del sistema (Windows en la app; la del navegador en modo demo). */
async function notify(title: string, body: string) {
  try {
    if (isTauri) {
      const n = await import("@tauri-apps/plugin-notification");
      let ok = await n.isPermissionGranted();
      if (!ok) ok = (await n.requestPermission()) === "granted";
      if (ok) n.sendNotification({ title, body });
    } else if ("Notification" in window) {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission === "granted") new Notification(title, { body });
    }
  } catch { /* sin notificaciones: la alerta igualmente queda guardada */ }
}

export function useAlerts(data: Snapshot | null, t: Dict) {
  const [alerts, setAlerts] = useState<AlertItem[]>(loadList);
  const [config, setConfig] = useState<AlertConfig>(() => load(KEY_CONFIG, DEFAULT_CONFIG));
  const overSince = useRef(new Map<string, number>()); // desde cuándo está por encima
  const armed = useRef(new Map<string, boolean>()); // false = ya avisó, esperando a que baje

  useEffect(() => save(KEY_ALERTS, alerts), [alerts]);
  useEffect(() => save(KEY_CONFIG, config), [config]);

  const label = useCallback((k: AlertKind) => t.alerts[k], [t]);

  const fire = useCallback((kind: AlertKind, name: string, value: number, limit: number) => {
    const item: AlertItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: Date.now(), kind, name, value: Math.round(value), limit, read: false,
    };
    setAlerts((a) => [item, ...a].slice(0, MAX_ALERTS));
    if (config.notify) {
      notify(t.alerts.notifTitle(label(kind)), `${name} · ${t.alerts.notifBody(item.value, limit)}`);
    }
  }, [config.notify, t, label]);

  // Revisar cada lectura de sensores
  useEffect(() => {
    if (!data || !config.enabled) return;
    const now = Date.now();
    const checks: [string, AlertKind, string, number | null | undefined][] = [
      ["cpu", "cpu", data.cpu?.name ?? "CPU", data.cpu?.temp],
      ["gpu", "gpu", data.gpu?.name ?? "GPU", data.gpu?.temp],
      ...data.disks.map((d) => [`disk:${d.name}`, "disk", d.name, d.temp] as [string, AlertKind, string, number | null]),
    ];
    for (const [key, kind, name, temp] of checks) {
      if (temp == null) continue;
      const limit = config[kind];
      if (temp > limit) {
        if (!overSince.current.has(key)) overSince.current.set(key, now);
        const since = overSince.current.get(key)!;
        if (now - since >= SUSTAIN_MS && armed.current.get(key) !== false) {
          armed.current.set(key, false);
          fire(kind, name, temp, limit);
        }
      } else {
        overSince.current.delete(key);
        if (temp <= limit - HYSTERESIS) armed.current.set(key, true);
      }
    }
  }, [data, config, fire]);

  const markAllRead = useCallback(() => setAlerts((a) => (a.some((x) => !x.read) ? a.map((x) => ({ ...x, read: true })) : a)), []);
  const markRead = useCallback((id: string) => setAlerts((a) => a.map((x) => (x.id === id ? { ...x, read: true } : x))), []);
  const clear = useCallback(() => setAlerts([]), []);
  const updateConfig = useCallback((patch: Partial<AlertConfig>) => setConfig((c) => ({ ...c, ...patch })), []);
  const resetLimits = useCallback(() => setConfig((c) => ({ ...c, ...RECOMMENDED })), []);

  /** Alerta de prueba (para comprobar que las notificaciones funcionan). */
  const test = useCallback(() => {
    const item: AlertItem = {
      id: `test-${Date.now()}`, time: Date.now(), kind: "cpu", name: t.alerts.testName,
      value: config.cpu + 5, limit: config.cpu, read: false,
    };
    setAlerts((a) => [item, ...a].slice(0, MAX_ALERTS));
    notify(t.alerts.notifTitle(t.alerts.cpu), `${t.alerts.testName} · ${t.alerts.notifBody(item.value, item.limit)}`);
  }, [config.cpu, t]);

  const unread = alerts.filter((a) => !a.read).length;
  return { alerts, config, unread, markAllRead, markRead, clear, updateConfig, resetLimits, test };
}

export type AlertsApi = ReturnType<typeof useAlerts>;
