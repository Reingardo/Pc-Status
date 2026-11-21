import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "./useSensors";

export interface Proc {
  pid: number;
  name: string;
  exe: string | null;
  cpu: number; // % del total
  memory: number; // bytes
  disk: number; // bytes/s
  protected: boolean;
}

/** Procesos agrupados por nombre (p. ej. todas las pestañas de Chrome juntas). */
export interface ProcGroup extends Omit<Proc, "pid"> {
  pids: number[];
}

const REFRESH_MS = 2000;

/** Lista de procesos; se actualiza mientras el componente que la usa está montado. */
export function useProcesses() {
  const [list, setList] = useState<Proc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const demo = useRef<Proc[]>(demoProcesses());

  const refresh = useCallback(async () => {
    if (!isTauri) {
      demo.current = demo.current.map((p) => ({
        ...p,
        cpu: Math.max(0, p.cpu + (Math.random() - 0.5) * Math.max(1, p.cpu * 0.4)),
        disk: Math.max(0, p.disk + (Math.random() - 0.5) * 200_000),
      }));
      setList([...demo.current]);
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      setList(await invoke<Proc[]>("list_processes"));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  /** Finaliza procesos; devuelve cuántos se cerraron. */
  const kill = useCallback(async (pids: number[]): Promise<number> => {
    if (!isTauri) {
      demo.current = demo.current.filter((p) => !pids.includes(p.pid));
      setList([...demo.current]);
      return pids.length;
    }
    const { invoke } = await import("@tauri-apps/api/core");
    const n = await invoke<number>("kill_processes", { pids });
    refresh();
    return n;
  }, [refresh]);

  return { list, error, kill };
}

export function groupByName(list: Proc[]): ProcGroup[] {
  const map = new Map<string, ProcGroup>();
  for (const p of list) {
    const key = p.name.toLowerCase();
    const g = map.get(key);
    if (g) {
      g.pids.push(p.pid);
      g.cpu += p.cpu;
      g.memory += p.memory;
      g.disk += p.disk;
      g.protected ||= p.protected;
    } else {
      map.set(key, { ...p, pids: [p.pid] });
    }
  }
  return [...map.values()];
}

// ------------------------------------------------------------------ demo

function demoProcesses(): Proc[] {
  const mk = (pid: number, name: string, cpu: number, mb: number, disk = 0, prot = false): Proc => ({
    pid, name, exe: null, cpu, memory: mb * 1_048_576, disk, protected: prot,
  });
  return [
    mk(1201, "chrome.exe", 6.2, 620, 40_000), mk(1202, "chrome.exe", 2.1, 310), mk(1203, "chrome.exe", 1.4, 280),
    mk(1204, "chrome.exe", 0.6, 190), mk(2210, "Discord.exe", 1.8, 410, 8_000), mk(2211, "Discord.exe", 0.4, 160),
    mk(3300, "DemoGame.exe", 18.5, 4200, 2_500_000), mk(4100, "Spotify.exe", 0.9, 240), mk(5150, "Code.exe", 2.6, 780, 12_000),
    mk(6001, "OneDrive.exe", 0.3, 150, 300_000), mk(7002, "obs64.exe", 4.4, 520, 900_000),
    mk(900, "svchost.exe", 0.7, 90, 0, true), mk(901, "svchost.exe", 0.2, 40, 0, true), mk(640, "dwm.exe", 1.1, 130, 0, true),
    mk(512, "explorer.exe", 0.5, 210, 0, true), mk(4, "System", 0.4, 8, 50_000, true),
  ];
}
