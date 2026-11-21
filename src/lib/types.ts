// Formato de cada lectura que envía el sidecar pc-sensors (una por segundo).
export interface Snapshot {
  time: number;
  admin: boolean;
  /** Driver PawnIO: sin él no hay temperatura de CPU, ventiladores ni voltajes. */
  pawnIo?: { installed: boolean; version: string | null };
  cpu: {
    name: string;
    load: number | null;
    temp: number | null;
    clock: number | null; // MHz
    power: number | null; // W
    cores: number[]; // % por núcleo
  } | null;
  gpu: {
    name: string;
    load: number | null;
    temp: number | null;
    clock: number | null;
    power: number | null;
    vramUsed: number | null; // MB
    vramTotal: number | null; // MB
    fanRpm: number | null;
  } | null;
  ram: { load: number | null; used: number | null; total: number | null } | null; // GB
  disks: { name: string; temp: number | null; used: number | null; activity: number | null }[];
  net: { name: string; up: number; down: number } | null; // bytes/s
  fans: { name: string; rpm: number }[];
}

export interface History {
  cpuLoad: number[];
  cpuTemp: number[];
  gpuLoad: number[];
  gpuTemp: number[];
  ramLoad: number[];
  netUp: number[];
  netDown: number[];
}
