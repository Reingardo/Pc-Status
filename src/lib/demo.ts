import type { Snapshot } from "./types";
import type { Inventory } from "./inventory";

/** Inventario ficticio para diseñar la vista "Mi PC" en el navegador. */
export function demoInventory(): Inventory {
  return {
    kind: "inventory",
    collectedAt: Date.now(),
    system: {
      computerName: "DEMO-PC", os: "Windows 11 Pro", version: "10.0.26100", build: "26100", arch: "64-bit",
      manufacturer: "Demo", model: "System Product Name", uptimeSec: 98_765,
    },
    cpus: [{ name: "Demo CPU 8-Core Processor", manufacturer: "Demo", cores: 8, threads: 16, maxClock: 4200, socket: "AM5", l2KB: 8192, l3KB: 32768 }],
    gpus: [{ name: "Demo GPU 12GB", vendor: "Demo", driver: "32.0.15.0000", driverDate: "2026-06-01", vramGB: 12, resolution: "2560 × 1440", refreshHz: 165 }],
    board: {
      manufacturer: "Demo Boards Inc.", product: "DEMO B650 GAMING", version: "Rev 1.0",
      biosVendor: "American Megatrends Inc.", biosVersion: "1.20", biosDate: "2026-03-10", sensorChip: "Nuvoton NCT6799D",
    },
    memory: {
      totalGB: 32, slots: 4,
      modules: [
        { slot: "DIMM_A2", capacityGB: 16, speed: 4800, maxSpeed: 4800, manufacturer: "G Skill Intl", partNumber: "F5-6000J3038F16G", type: "DDR5" },
        { slot: "DIMM_B2", capacityGB: 16, speed: 4800, maxSpeed: 4800, manufacturer: "G Skill Intl", partNumber: "F5-6000J3038F16G", type: "DDR5" },
      ],
    },
    disks: [
      { model: "Demo NVMe 2TB", sizeGB: 1863, media: "SSD", bus: "NVMe" },
      { model: "Demo HDD 4TB", sizeGB: 3726, media: "HDD", bus: "SATA" },
    ],
    network: [
      { name: "Demo 2.5GbE Controller", connection: "Ethernet", speedMbps: 2500, connected: true },
      { name: "Demo Wi-Fi 6E", connection: "Wi-Fi", speedMbps: null, connected: false },
    ],
    monitors: [{ name: "DEMO 27Q", manufacturer: "DEM" }],
    audio: [{ name: "Demo HD Audio", manufacturer: "Demo" }],
    sensorHardware: [
      { type: "Motherboard", name: "DEMO B650 GAMING" },
      { type: "SuperIO", name: "Nuvoton NCT6799D" },
      { type: "Cpu", name: "Demo CPU" },
      { type: "GpuNvidia", name: "Demo GPU" },
      { type: "Storage", name: "Demo NVMe 2TB" },
    ],
  };
}

// Datos falsos con "paseo aleatorio" para diseñar la interfaz en el navegador.
const walk = (v: number | null | undefined, base: number, step: number, min: number, max: number) => {
  const cur = v ?? base;
  const pull = (base - cur) * 0.08;
  return Math.round(Math.min(max, Math.max(min, cur + pull + (Math.random() - 0.5) * step)) * 10) / 10;
};

export function demoSnapshot(prev: Snapshot | null): Snapshot {
  const cores = Array.from({ length: 16 }, (_, i) => walk(prev?.cpu?.cores[i], 25 + (i % 4) * 8, 30, 1, 100));
  const cpuLoad = Math.round((cores.reduce((a, b) => a + b, 0) / cores.length) * 10) / 10;
  const gpuLoad = walk(prev?.gpu?.load, 45, 18, 0, 100);
  return {
    time: Date.now(),
    admin: true,
    // ?nopawnio en la URL simula que falta el driver (para ver el aviso)
    pawnIo: { installed: !new URLSearchParams(location.search).has("nopawnio"), version: "2.2.0" },
    cpu: {
      name: "Demo CPU 8-Core",
      load: cpuLoad,
      temp: walk(prev?.cpu?.temp, 38 + cpuLoad * 0.4, 3, 30, 95),
      clock: walk(prev?.cpu?.clock, 4400, 250, 3000, 5400),
      power: walk(prev?.cpu?.power, 25 + cpuLoad * 0.9, 8, 10, 180),
      cores,
    },
    gpu: {
      name: "Demo GPU",
      load: gpuLoad,
      temp: walk(prev?.gpu?.temp, 40 + gpuLoad * 0.35, 2, 30, 90),
      clock: walk(prev?.gpu?.clock, 1900, 120, 300, 2800),
      power: walk(prev?.gpu?.power, 40 + gpuLoad * 2.2, 15, 10, 350),
      vramUsed: walk(prev?.gpu?.vramUsed, 4300, 300, 800, 12000),
      vramTotal: 12288,
      fanRpm: walk(prev?.gpu?.fanRpm, 900 + gpuLoad * 12, 60, 0, 3000),
    },
    ram: (() => {
      const used = walk(prev?.ram?.used, 14.2, 0.6, 6, 31);
      return { used, total: 31.9, load: Math.round((used / 31.9) * 1000) / 10 };
    })(),
    disks: [
      { name: "Samsung SSD 990 PRO 2TB", temp: walk(prev?.disks[0]?.temp, 42, 1, 30, 70), used: 61.4, activity: walk(prev?.disks[0]?.activity, 6, 12, 0, 100) },
      { name: "WD Blue SN580 1TB", temp: walk(prev?.disks[1]?.temp, 36, 1, 30, 70), used: 82.7, activity: walk(prev?.disks[1]?.activity, 2, 6, 0, 100) },
    ],
    net: {
      name: "Ethernet",
      up: Math.max(0, walk(prev?.net?.up, 180_000, 200_000, 0, 5_000_000)),
      down: Math.max(0, walk(prev?.net?.down, 2_400_000, 2_000_000, 0, 60_000_000)),
    },
    fans: [
      { name: "CPU Fan", rpm: Math.round(walk(prev?.fans[0]?.rpm, 1100 + cpuLoad * 8, 40, 400, 2400)) },
      { name: "Pump", rpm: Math.round(walk(prev?.fans[1]?.rpm, 2600, 30, 2000, 3200)) },
      { name: "Sys Fan #1", rpm: Math.round(walk(prev?.fans[2]?.rpm, 850, 30, 400, 1800)) },
      { name: "Sys Fan #2", rpm: Math.round(walk(prev?.fans[3]?.rpm, 870, 30, 400, 1800)) },
    ],
  };
}
