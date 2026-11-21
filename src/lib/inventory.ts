import { useCallback, useEffect, useState } from "react";
import { isTauri } from "./useSensors";

// Inventario de hardware que envía el sidecar (sensors/Inventory.cs).
export interface Inventory {
  kind: "inventory";
  collectedAt: number;
  system: {
    computerName: string;
    os: string | null;
    version: string | null;
    build: string | null;
    arch: string | null;
    manufacturer: string | null;
    model: string | null;
    uptimeSec: number;
  };
  cpus: {
    name: string | null; manufacturer: string | null; cores: number | null; threads: number | null;
    maxClock: number | null; socket: string | null; l2KB: number | null; l3KB: number | null;
  }[];
  gpus: {
    name: string; vendor: string | null; driver: string | null; driverDate: string | null;
    vramGB: number; resolution: string | null; refreshHz: number | null;
  }[];
  board: {
    manufacturer: string | null; product: string | null; version: string | null;
    biosVendor: string | null; biosVersion: string | null; biosDate: string | null; sensorChip: string | null;
  };
  memory: {
    totalGB: number;
    slots: number;
    modules: {
      slot: string | null; capacityGB: number; speed: number | null; maxSpeed: number | null;
      manufacturer: string | null; partNumber: string | null; type: string | null;
    }[];
  };
  disks: { model: string | null; sizeGB: number; media: string | null; bus: string | null }[];
  network: { name: string | null; connection: string | null; speedMbps: number | null; connected: boolean }[];
  monitors: { name: string | null; manufacturer: string | null }[];
  audio: { name: string | null; manufacturer: string | null }[];
  sensorHardware: { type: string; name: string }[];
}

/** Inventario de hardware + función para volver a detectarlo. */
export function useInventory() {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    if (!isTauri) {
      import("./demo").then(({ demoInventory }) => {
        setTimeout(() => { setInventory(demoInventory()); setScanning(false); }, 600);
      });
      return;
    }
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const { invoke } = await import("@tauri-apps/api/core");
      const off = await listen<string>("inventory", (e) => {
        setInventory(JSON.parse(e.payload));
        setScanning(false);
      });
      if (cancelled) return off();
      unlisten = off;
      // Por si el inventario llegó antes de que la interfaz empezara a escuchar.
      const cached = await invoke<string | null>("get_inventory");
      if (cached) { setInventory(JSON.parse(cached)); setScanning(false); }
    })();
    return () => { cancelled = true; unlisten?.(); };
  }, []);

  const rescan = useCallback(async () => {
    setScanning(true);
    if (!isTauri) {
      const { demoInventory } = await import("./demo");
      setTimeout(() => { setInventory(demoInventory()); setScanning(false); }, 900);
      return;
    }
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      await invoke("refresh_inventory");
    } catch {
      setScanning(false);
    }
  }, []);

  return { inventory, scanning, rescan };
}

/**
 * Velocidad nominal del kit de RAM a partir del número de pieza, si se reconoce
 * (G.Skill "F4-3600C18…", Corsair "CMK32GX4M2D3600C18", Kingston Fury "KF436C18…").
 */
export function ratedRamSpeed(part: string | null | undefined): number | null {
  if (!part) return null;
  const p = part.toUpperCase();
  const gskill = p.match(/^F[45]-(\d{4})/);
  if (gskill) return +gskill[1];
  const corsair = p.match(/^CM[A-Z0-9]+M\d[A-Z]?(\d{4})C/);
  if (corsair) return +corsair[1];
  const kingston = p.match(/^KF[45](\d{2})C/);
  if (kingston) return +kingston[1] * 100;
  return null;
}
