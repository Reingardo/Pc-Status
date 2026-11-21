import { motion, useSpring, useTransform } from "motion/react";
import { useEffect, useId } from "react";

// Escala no lineal como en los velocímetros de internet: cada tramo ocupa lo mismo.
const MARKS = [0, 5, 10, 25, 50, 100, 250, 500, 1000];
const START = -120; // grados
const SWEEP = 240;

/** Convierte Mb/s a fracción 0–1 del arco. */
function toFraction(mbps: number) {
  const v = Math.max(0, Math.min(mbps, MARKS[MARKS.length - 1]));
  for (let i = 1; i < MARKS.length; i++) {
    if (v <= MARKS[i]) {
      const seg = (v - MARKS[i - 1]) / (MARKS[i] - MARKS[i - 1]);
      return (i - 1 + seg) / (MARKS.length - 1);
    }
  }
  return 1;
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};

const arcPath = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

interface Props {
  value: number; // Mb/s
  colors: [string, string];
  children?: React.ReactNode; // centro (número, botón...)
  showNeedle?: boolean;
}

/** Velocímetro de 240° con escala 0–1000 Mb/s y aguja animada. */
export function SpeedGauge({ value, colors, children, showNeedle = true }: Props) {
  const id = useId();
  const spring = useSpring(0, { stiffness: 70, damping: 16 });
  useEffect(() => spring.set(toFraction(value)), [spring, value]);

  const cx = 160, cy = 160, r = 130;
  const len = (Math.PI * 2 * r * SWEEP) / 360;
  const dash = useTransform(spring, (f) => `${f * len} ${len * 2}`);
  const needle = useTransform(spring, (f) => START + f * SWEEP);
  // Con valor 0 el extremo redondeado del trazo se vería como un punto: lo ocultamos.
  const visible = useTransform(spring, (f) => (f > 0.004 ? 1 : 0));
  const glowOpacity = useTransform(spring, (f) => (f > 0.004 ? "calc(var(--glow) * 0.6)" : "0"));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[360px]">
      <svg viewBox="0 0 320 320" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`sg${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={colors[1]} />
            <stop offset="100%" stopColor={colors[0]} />
          </linearGradient>
          <filter id={`sf${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* pista */}
        <path d={arcPath(cx, cy, r, START, START + SWEEP)} fill="none" stroke="var(--color-track)" strokeWidth="18" strokeLinecap="round" />
        {/* brillo + valor */}
        <motion.path d={arcPath(cx, cy, r, START, START + SWEEP)} fill="none" stroke={`url(#sg${id})`} strokeWidth="18"
          strokeLinecap="round" filter={`url(#sf${id})`} style={{ strokeDasharray: dash, opacity: glowOpacity }} />
        <motion.path d={arcPath(cx, cy, r, START, START + SWEEP)} fill="none" stroke={`url(#sg${id})`} strokeWidth="18"
          strokeLinecap="round" style={{ strokeDasharray: dash, opacity: visible }} />

        {/* marcas */}
        {MARKS.map((m, i) => {
          const deg = START + (i / (MARKS.length - 1)) * SWEEP;
          const [tx, ty] = polar(cx, cy, r - 32, deg);
          const [a1, b1] = polar(cx, cy, r - 14, deg);
          const [a2, b2] = polar(cx, cy, r - 20, deg);
          return (
            <g key={m}>
              <line x1={a1} y1={b1} x2={a2} y2={b2} stroke="var(--color-muted)" strokeWidth="1.5" opacity="0.6" />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill="var(--color-muted)"
                fontSize="11" fontFamily="var(--font-display)" className="tabular-nums">{m}</text>
            </g>
          );
        })}

      </svg>
      {/* aguja: capa HTML que gira sobre el centro */}
      {showNeedle && (
        <motion.div className="pointer-events-none absolute inset-0" style={{ rotate: needle }}>
          <svg viewBox="0 0 320 320" className="h-full w-full">
            <path d={`M ${cx - 4} ${cy} L ${cx} ${cy - r + 26} L ${cx + 4} ${cy} Z`} fill={colors[0]} />
            <circle cx={cx} cy={cy} r="7" fill="var(--color-fg)" />
            <circle cx={cx} cy={cy} r="3" fill="var(--color-bg)" />
          </svg>
        </motion.div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-[38%]">{children}</div>
    </div>
  );
}
