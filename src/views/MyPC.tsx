import { motion } from "motion/react";
import { Card } from "../components/Card";
import { ratedRamSpeed, type Inventory } from "../lib/inventory";

interface Props {
  inventory: Inventory | null;
  scanning: boolean;
  rescan: () => void;
}

/** Vista "Mi PC": todos los componentes de hardware detectados. */
export function MyPC({ inventory: inv, scanning, rescan }: Props) {
  if (!inv) return <Skeleton />;

  const cpu = inv.cpus[0];
  const totalStorage = inv.disks.reduce((a, d) => a + d.sizeGB, 0);
  const memType = inv.memory.modules[0]?.type;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Cabecera ---------- */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="card relative overflow-hidden rounded-[var(--radius)] p-6">
        <div className="pointer-events-none absolute -left-20 -top-28 h-64 w-64 rounded-full glow-blob blur-3xl" style={{ background: "var(--color-cpu)" }} />
        <div className="pointer-events-none absolute -right-10 -bottom-32 h-64 w-64 rounded-full glow-blob blur-3xl" style={{ background: "var(--color-gpu)" }} />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            <PcIcon />
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">{inv.system.computerName}</h1>
              <p className="mt-1 text-sm text-muted">
                {[inv.system.os, inv.system.arch, inv.system.build && `build ${inv.system.build}`].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Encendido hace <span className="text-fg">{fmtUptime(inv.system.uptimeSec + (Date.now() - inv.collectedAt) / 1000)}</span>
              </p>
            </div>
          </div>
          <button onClick={rescan} disabled={scanning}
            className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-line bg-tint px-4 py-2 text-sm text-fg transition hover:bg-tint-2 disabled:opacity-60">
            <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              animate={scanning ? { rotate: 360 } : { rotate: 0 }}
              transition={scanning ? { repeat: Infinity, duration: 0.9, ease: "linear" } : { duration: 0 }}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            </motion.svg>
            {scanning ? "Detectando…" : "Detectar de nuevo"}
          </button>
        </div>

        {/* Resumen rápido */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Chip label="Procesador" value={cpu ? `${cpu.cores ?? "?"} núcleos / ${cpu.threads ?? "?"} hilos` : "—"} color="var(--color-cpu)" />
          <Chip label="Gráfica" value={inv.gpus[0] ? `${shortGpu(inv.gpus[0].name)} · ${inv.gpus[0].vramGB} GB` : "—"} color="var(--color-gpu)" />
          <Chip label="Memoria" value={`${inv.memory.totalGB} GB ${memType ?? ""}`} color="var(--color-ram)" />
          <Chip label="Almacenamiento" value={fmtSize(totalStorage)} color="var(--color-disk)" />
        </div>
      </motion.section>

      <div className="grid grid-cols-12 gap-4">
        {/* ---------- Procesador ---------- */}
        {inv.cpus.map((c, i) => (
          <Card key={i} title="Procesador" accent="var(--color-cpu)" className="col-span-12 md:col-span-6 xl:col-span-4" delay={0.05}>
            <Name>{c.name}</Name>
            <Rows rows={[
              ["Fabricante", vendor(c.manufacturer)],
              ["Núcleos / hilos", c.cores && c.threads ? `${c.cores} / ${c.threads}` : null],
              ["Frecuencia base", c.maxClock ? `${(c.maxClock / 1000).toFixed(2)} GHz` : null],
              ["Socket", c.socket],
              ["Caché L2", c.l2KB ? fmtCache(c.l2KB) : null],
              ["Caché L3", c.l3KB ? fmtCache(c.l3KB) : null],
            ]} />
          </Card>
        ))}

        {/* ---------- Gráficas ---------- */}
        {inv.gpus.map((g, i) => (
          <Card key={i} title={inv.gpus.length > 1 ? `Gráfica ${i + 1}` : "Gráfica"} accent="var(--color-gpu)"
            className="col-span-12 md:col-span-6 xl:col-span-4" delay={0.1}>
            <Name>{g.name}</Name>
            <Rows rows={[
              ["Fabricante", g.vendor],
              ["Memoria de vídeo", g.vramGB ? `${g.vramGB} GB` : null],
              ["Controlador", g.driver],
              ["Fecha del controlador", g.driverDate],
              ["Resolución actual", g.resolution ? `${g.resolution}${g.refreshHz ? ` @ ${g.refreshHz} Hz` : ""}` : null],
            ]} />
          </Card>
        ))}

        {/* ---------- Placa base ---------- */}
        <Card title="Placa base" accent="var(--color-net)" className="col-span-12 md:col-span-6 xl:col-span-4" delay={0.15}>
          <Name>{inv.board.product ?? "Desconocida"}</Name>
          <Rows rows={[
            ["Fabricante", inv.board.manufacturer],
            ["Revisión", inv.board.version],
            ["BIOS", [inv.board.biosVendor, inv.board.biosVersion].filter(Boolean).join(" · ") || null],
            ["Fecha de la BIOS", inv.board.biosDate],
            ["Chip de sensores", inv.board.sensorChip ?? "Requiere administrador"],
          ]} />
        </Card>

        {/* ---------- Memoria ---------- */}
        <Card title="Memoria RAM" subtitle={`${inv.memory.modules.length} de ${inv.memory.slots} ranuras ocupadas`}
          accent="var(--color-ram)" className="col-span-12 xl:col-span-8" delay={0.2}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: Math.max(inv.memory.slots, inv.memory.modules.length) }, (_, i) => {
              const m = inv.memory.modules[i];
              return m ? (
                <div key={i} className="relative overflow-hidden rounded-[var(--radius-sm)] border border-line bg-tint p-3">
                  <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: "linear-gradient(to right, var(--color-ram), var(--color-ram-2))" }} />
                  <div className="text-[11px] uppercase tracking-wider text-muted">{m.slot ?? `Ranura ${i + 1}`}</div>
                  <div className="mt-1 font-display text-2xl font-semibold text-fg">{m.capacityGB} GB</div>
                  <div className="text-sm text-muted">{[m.type, m.speed && `${m.speed} MHz`].filter(Boolean).join(" · ")}</div>
                  <div className="mt-2 truncate text-xs text-muted" title={m.partNumber ?? ""}>{m.manufacturer}</div>
                  <div className="truncate font-mono text-[11px] text-muted/80">{m.partNumber}</div>
                </div>
              ) : (
                <div key={i} className="flex min-h-28 flex-col items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-line text-sm text-muted">
                  <span className="text-[11px] uppercase tracking-wider">Ranura {i + 1}</span>
                  Vacía
                </div>
              );
            })}
          </div>
          <RamTip modules={inv.memory.modules} />
        </Card>

        {/* ---------- Almacenamiento ---------- */}
        <Card title="Almacenamiento" subtitle={fmtSize(totalStorage)} accent="var(--color-disk)" className="col-span-12 md:col-span-6 xl:col-span-4" delay={0.25}>
          <ul className="flex flex-col gap-3">
            {inv.disks.map((d, i) => (
              <li key={i} className="flex items-center gap-3">
                <DiskIcon />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-fg" title={d.model ?? ""}>{d.model}</div>
                  <div className="text-xs text-muted">{fmtSize(d.sizeGB)}</div>
                </div>
                {(d.bus || d.media) && <Badge>{[d.bus, d.media].filter(Boolean).join(" ")}</Badge>}
              </li>
            ))}
          </ul>
        </Card>

        {/* ---------- Pantallas ---------- */}
        <Card title="Pantallas" accent="var(--color-fan)" className="col-span-12 md:col-span-6 xl:col-span-4" delay={0.3}>
          <List empty="No se detectaron pantallas"
            items={inv.monitors.map((m) => ({ main: m.name, sub: monitorBrand(m.manufacturer) }))} />
        </Card>

        {/* ---------- Red ---------- */}
        <Card title="Red" accent="var(--color-net)" className="col-span-12 md:col-span-6 xl:col-span-4" delay={0.35}>
          <ul className="flex flex-col gap-3">
            {inv.network.map((n, i) => (
              <li key={i} className={`flex items-center gap-3 ${n.connected ? "" : "opacity-50"}`}>
                <span className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: n.connected ? "var(--color-ok)" : "var(--color-muted)", boxShadow: n.connected ? "0 0 8px var(--color-ok)" : "none" }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-fg" title={n.name ?? ""}>{n.name}</div>
                  <div className="text-xs text-muted">{n.connection} · {n.connected ? "Conectado" : "Desconectado"}</div>
                </div>
                {n.connected && n.speedMbps ? <Badge>{n.speedMbps >= 1000 ? `${n.speedMbps / 1000} Gb/s` : `${n.speedMbps} Mb/s`}</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>

        {/* ---------- Audio ---------- */}
        <Card title="Audio" accent="var(--color-gpu-2)" className="col-span-12 md:col-span-6 xl:col-span-4" delay={0.4}>
          <List empty="No se detectaron dispositivos de audio"
            items={inv.audio.map((a) => ({ main: a.name, sub: a.manufacturer }))} />
        </Card>

        {/* ---------- Sensores ---------- */}
        <Card title="Sensores disponibles" subtitle="LibreHardwareMonitor" accent="var(--color-warn)" className="col-span-12 xl:col-span-8" delay={0.45}>
          <div className="flex flex-wrap gap-2">
            {inv.sensorHardware.map((s, i) => (
              <span key={i} className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-line bg-tint px-3 py-1 text-xs">
                <span className="text-muted">{sensorType(s.type)}</span>
                <span className="text-fg">{s.name}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Estos son los componentes de los que la app puede leer temperaturas, ventiladores o consumo.
            Con permisos de administrador aparecen más (chip de la placa, discos, etc.).
          </p>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ piezas

function RamTip({ modules }: { modules: Inventory["memory"]["modules"] }) {
  const m = modules.find((x) => ratedRamSpeed(x.partNumber));
  const rated = ratedRamSpeed(m?.partNumber);
  if (!m || !rated || !m.speed || rated - m.speed < 100) return null;
  return (
    <div className="mt-4 flex gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-warn)]/30 bg-[color:var(--color-warn)]/10 p-3 text-sm">
      <span className="text-lg leading-none">⚡</span>
      <p className="text-fg">
        Tus módulos son de <b>{rated} MHz</b> pero funcionan a <b>{m.speed} MHz</b>.
        <span className="text-muted"> Activa el perfil <b className="text-fg">DOCP / XMP / EXPO</b> en la BIOS para usar su velocidad completa.</span>
      </p>
    </div>
  );
}

function Name({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 font-display text-lg font-medium leading-snug text-fg">{children}</div>;
}

function Rows({ rows }: { rows: [string, string | number | null | undefined][] }) {
  return (
    <dl className="flex flex-col divide-y divide-line">
      {rows.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="truncate text-right text-fg" title={String(v)}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function List({ items, empty }: { items: { main: string | null; sub: string | null }[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={i}>
          <div className="truncate text-sm text-fg">{it.main}</div>
          {it.sub && <div className="text-xs text-muted">{it.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-line bg-inset px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        {label}
      </div>
      <div className="mt-1 truncate font-display text-base font-medium text-fg" title={value}>{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-[var(--radius-pill)] bg-tint-2 px-2.5 py-0.5 text-[11px] font-medium text-fg">{children}</span>;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="shimmer h-52 rounded-[var(--radius)]" />
      <div className="grid grid-cols-12 gap-4">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer col-span-12 h-56 rounded-[var(--radius)] md:col-span-6 xl:col-span-4" />)}
      </div>
      <p className="text-center text-sm text-muted">Detectando componentes…</p>
    </div>
  );
}

function PcIcon() {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius)] border border-line"
      style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--color-cpu) 25%, transparent), color-mix(in oklab, var(--color-gpu) 25%, transparent))" }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-fg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <circle cx="12" cy="15" r="3" />
        <path d="M9 6h6M9 9h6" />
      </svg>
    </div>
  );
}

function DiskIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-disk)" strokeWidth="1.6" className="shrink-0">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h4M7 14h2" strokeLinecap="round" />
      <circle cx="17" cy="12" r="1.2" fill="var(--color-disk)" />
    </svg>
  );
}

// ------------------------------------------------------------------ formato

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

const fmtSize = (gb: number) => (gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${Math.round(gb)} GB`);
const fmtCache = (kb: number) => (kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`);
const shortGpu = (n: string) => n.replace(/^(NVIDIA|AMD|Intel\(R\))\s+/i, "").replace(/^GeForce\s+/i, "");

const vendor = (v: string | null) =>
  v === "AuthenticAMD" ? "AMD" : v === "GenuineIntel" ? "Intel" : v;

const MONITOR_BRANDS: Record<string, string> = {
  DEL: "Dell", ACI: "ASUS", AUS: "ASUS", SAM: "Samsung", GSM: "LG", ACR: "Acer", BNQ: "BenQ",
  MSI: "MSI", AOC: "AOC", HWP: "HP", HPN: "HP", LEN: "Lenovo", GBT: "Gigabyte", PHL: "Philips",
  VSC: "ViewSonic", SNY: "Sony", AOU: "AOC",
};
const monitorBrand = (code: string | null) => (code ? MONITOR_BRANDS[code] ?? code : null);

const SENSOR_TYPES: Record<string, string> = {
  Motherboard: "Placa", SuperIO: "Chip placa", EmbeddedController: "Controlador", Cpu: "CPU",
  Memory: "RAM", GpuNvidia: "GPU", GpuAmd: "GPU", GpuIntel: "GPU", Storage: "Disco",
  Cooler: "Refrigeración", Psu: "Fuente", Battery: "Batería",
};
const sensorType = (t: string) => SENSOR_TYPES[t] ?? t;
