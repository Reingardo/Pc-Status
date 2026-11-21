import { motion } from "motion/react";
import { Card, Stat } from "../components/Card";
import { Gauge } from "../components/Gauge";
import { Sparkline } from "../components/Sparkline";
import { fmt, fmtGHz, fmtSpeed, tempColor } from "../lib/format";
import type { History, Snapshot } from "../lib/types";

const CPU: [string, string] = ["var(--color-cpu)", "var(--color-cpu-2)"];
const GPU: [string, string] = ["var(--color-gpu)", "var(--color-gpu-2)"];
const RAM: [string, string] = ["var(--color-ram)", "var(--color-ram-2)"];

/** Vista "Panel": uso y temperaturas en tiempo real. */
export function Dashboard({ data, history }: { data: Snapshot | null; history: History }) {
  const cpu = data?.cpu;
  const gpu = data?.gpu;
  const ram = data?.ram;

  return (
    <>

        <div className="grid grid-cols-12 gap-4">
          {/* ---------- CPU ---------- */}
          <Card title="Procesador" subtitle={cpu?.name} accent="var(--color-cpu)" className="col-span-12 lg:col-span-4">
            <div className="flex justify-center">
              <Gauge value={cpu?.load} label="Uso" colors={CPU}>
                <Temp value={cpu?.temp} />
              </Gauge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Stat label="Frecuencia" value={fmtGHz(cpu?.clock)} />
              <Stat label="Consumo" value={fmt(cpu?.power, " W")} />
            </div>
            <div className="mt-3"><Sparkline data={history.cpuLoad} color="var(--color-cpu)" max={100} /></div>
          </Card>

          {/* ---------- GPU ---------- */}
          <Card title="Gráfica" subtitle={gpu?.name} accent="var(--color-gpu)" className="col-span-12 lg:col-span-4" delay={0.06}>
            <div className="flex justify-center">
              <Gauge value={gpu?.load} label="Uso" colors={GPU}>
                <Temp value={gpu?.temp} />
              </Gauge>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Stat label="Núcleo" value={fmt(gpu?.clock, " MHz")} />
              <Stat label="Consumo" value={fmt(gpu?.power, " W")} />
              <Stat label="Ventilador" value={fmt(gpu?.fanRpm, " rpm")} />
            </div>
            <div className="mt-3"><Sparkline data={history.gpuLoad} color="var(--color-gpu)" max={100} /></div>
          </Card>

          {/* ---------- RAM ---------- */}
          <Card title="Memoria" subtitle={gpu?.vramTotal ? `VRAM ${fmt((gpu.vramUsed ?? 0) / 1024, "", 1)} / ${fmt(gpu.vramTotal / 1024, " GB", 0)}` : undefined}
            accent="var(--color-ram)" className="col-span-12 lg:col-span-4" delay={0.12}>
            <div className="flex justify-center">
              <Gauge value={ram?.load} label="RAM" colors={RAM}>
                <span className="text-sm tabular-nums text-muted">
                  {fmt(ram?.used, "", 1)} / {fmt(ram?.total, " GB", 0)}
                </span>
              </Gauge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Stat label="En uso" value={fmt(ram?.used, " GB", 1)} />
              <Stat label="Libre" value={ram?.total != null && ram.used != null ? fmt(ram.total - ram.used, " GB", 1) : "—"} />
            </div>
            <div className="mt-3"><Sparkline data={history.ramLoad} color="var(--color-ram)" max={100} /></div>
          </Card>

          {/* ---------- Núcleos ---------- */}
          <Card title="Núcleos" subtitle={cpu?.cores.length ? `${cpu.cores.length} hilos` : undefined}
            accent="var(--color-cpu)" className="col-span-12 lg:col-span-5" delay={0.18}>
            <div className={`grid gap-2 ${(cpu?.cores.length ?? 0) > 16 ? "grid-cols-12" : "grid-cols-8"}`}>
              {(cpu?.cores ?? []).map((v, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className={`relative w-full overflow-hidden rounded-[var(--radius-xs)] bg-[color:var(--color-track)] ${
                    (cpu?.cores.length ?? 0) > 16 ? "h-16" : "h-24"}`}>
                    <motion.div className="absolute inset-x-0 bottom-0 rounded-[var(--radius-xs)]"
                      style={{ background: "linear-gradient(to top, var(--color-cpu-2), var(--color-cpu))" }}
                      animate={{ height: `${v}%` }} transition={{ type: "spring", stiffness: 70, damping: 18 }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted">{i + 1}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-muted">
                <span>Temperatura CPU · 60 s</span><span style={{ color: tempColor(cpu?.temp) }}>{fmt(cpu?.temp, " °C")}</span>
              </div>
              <Sparkline data={history.cpuTemp} color={tempColor(cpu?.temp)} max={100} height={44} />
            </div>
          </Card>

          {/* ---------- Red ---------- */}
          <Card title="Red" subtitle={data?.net?.name} accent="var(--color-net)" className="col-span-12 md:col-span-6 lg:col-span-4" delay={0.24}>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="↓ Descarga" value={fmtSpeed(data?.net?.down)} color="var(--color-net)" />
              <Stat label="↑ Subida" value={fmtSpeed(data?.net?.up)} color="var(--color-ram)" />
            </div>
            <div className="relative mt-4">
              <Sparkline data={history.netDown} color="var(--color-net)" height={110} />
              <div className="absolute inset-0"><Sparkline data={history.netUp} color="var(--color-ram)" height={110}
                max={Math.max(1, ...history.netDown, ...history.netUp) * 1.15} /></div>
            </div>
          </Card>

          {/* ---------- Ventiladores ---------- */}
          <Card title="Ventiladores" accent="var(--color-fan)" className="col-span-12 md:col-span-6 lg:col-span-3" delay={0.3}>
            {data?.fans.length ? (
              <ul className="flex flex-col gap-3">
                {data.fans.map((f) => (
                  <li key={f.name} className="flex items-center gap-3">
                    <motion.svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0 text-[color:var(--color-fan)]"
                      animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: Math.max(0.3, 1500 / Math.max(f.rpm, 1)) }}>
                      <FanIcon />
                    </motion.svg>
                    <span className="flex-1 truncate text-sm text-muted">{f.name}</span>
                    <span className="font-display tabular-nums text-fg">{f.rpm}<span className="ml-1 text-xs text-muted">rpm</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No se detectaron ventiladores. Puede requerir permisos de administrador o tu placa no los expone.</p>
            )}
          </Card>

          {/* ---------- Discos ---------- */}
          <Card title="Almacenamiento" accent="var(--color-disk)" className="col-span-12" delay={0.36}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(data?.disks ?? []).map((d) => (
                <div key={d.name} className="rounded-[var(--radius-sm)] bg-tint p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-fg" title={d.name}>{d.name}</span>
                    <span className="shrink-0 text-sm tabular-nums" style={{ color: tempColor(d.temp) }}>{fmt(d.temp, " °C")}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-[var(--radius-pill)] bg-[color:var(--color-track)]">
                    <motion.div className="h-full rounded-[var(--radius-pill)]"
                      style={{ background: "linear-gradient(to right, var(--color-disk), var(--color-cpu))" }}
                      initial={{ width: 0 }} animate={{ width: `${d.used ?? 0}%` }} transition={{ duration: 0.8 }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                    <span>{fmt(d.used, "% usado")}</span>
                    <span>Actividad {fmt(d.activity, "%")}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
    </>
  );
}

function Temp({ value }: { value: number | null | undefined }) {
  return (
    <span className="flex items-center gap-1 text-sm font-medium tabular-nums" style={{ color: tempColor(value) }}>
      <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
        <path d="M5 0a2.5 2.5 0 0 0-2.5 2.5v7.1a4 4 0 1 0 5 0V2.5A2.5 2.5 0 0 0 5 0Z" />
      </svg>
      {fmt(value, " °C")}
    </span>
  );
}

function FanIcon() {
  return (
    <g fill="currentColor">
      <circle cx="12" cy="12" r="2.2" />
      {[0, 120, 240].map((r) => (
        <path key={r} transform={`rotate(${r} 12 12)`} d="M12 9.5c-1-3.5.5-7 3.5-7 2 0 2.5 2.5.5 4.5-1.3 1.3-2.6 1.8-4 2.5Z" opacity="0.9" />
      ))}
    </g>
  );
}
