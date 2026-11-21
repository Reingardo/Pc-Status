import { motion } from "motion/react";
import { useId } from "react";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  value: number | null | undefined; // 0–100
  label: string;
  colors: [string, string]; // degradado del arco
  size?: number;
  children?: React.ReactNode; // contenido extra bajo el número
}

const SWEEP = 0.75; // el arco ocupa 270°

/** Medidor circular animado al estilo de los paneles de hardware. */
export function Gauge({ value, label, colors, size = 200, children }: Props) {
  const id = useId();
  const r = 80;
  const c = 2 * Math.PI * r;
  const arc = c * SWEEP;
  const pct = Math.min(100, Math.max(0, value ?? 0)) / 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="h-full w-full" style={{ transform: "rotate(135deg)" }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
          <filter id={`f${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {/* pista */}
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--color-track)" strokeWidth="12"
          strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
        {/* brillo */}
        <motion.circle cx="100" cy="100" r={r} fill="none" stroke={`url(#g${id})`} strokeWidth="12"
          strokeLinecap="round" filter={`url(#f${id})`} style={{ opacity: "calc(var(--glow) * 0.55)" }}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${arc * pct} ${c}` }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }} />
        {/* valor */}
        <motion.circle cx="100" cy="100" r={r} fill="none" stroke={`url(#g${id})`} strokeWidth="12"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${arc * pct} ${c}` }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</span>
        <span className="font-display text-5xl font-semibold tabular-nums leading-none text-fg">
          {value == null ? "—" : <AnimatedNumber value={value} />}
          <span className="ml-0.5 text-2xl text-muted">%</span>
        </span>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
