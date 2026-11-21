import { motion } from "motion/react";

interface Props {
  title: string;
  subtitle?: string;
  accent?: string;
  className?: string;
  delay?: number;
  children: React.ReactNode;
}

/** Tarjeta de vidrio con un brillo del color de acento. */
export function Card({ title, subtitle, accent = "var(--color-cpu)", className = "", delay = 0, children }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`card relative overflow-hidden rounded-[var(--radius)] p-5 ${className}`}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full glow-blob blur-3xl"
        style={{ background: accent }} />
      <header className="relative mb-4 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-fg">
          <span className="h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
          {title}
        </h2>
        {subtitle && <span className="truncate text-xs text-muted" title={subtitle}>{subtitle}</span>}
      </header>
      <div className="relative">{children}</div>
    </motion.section>
  );
}

/** Fila "etiqueta — valor" para estadísticas. */
export function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {/* truncate: en otros idiomas las etiquetas pueden ser largas */}
      <span className="truncate text-[11px] uppercase tracking-wider text-muted" title={label}>{label}</span>
      <span className="font-display text-lg font-medium tabular-nums" style={{ color: color ?? "var(--color-fg)" }}>
        {value}
      </span>
    </div>
  );
}
