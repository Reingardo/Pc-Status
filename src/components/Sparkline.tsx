import { useId } from "react";

interface Props {
  data: number[];
  color: string;
  max?: number; // fijo (p. ej. 100 para %); si no, se ajusta a los datos
  height?: number;
  length?: number; // nº de puntos visibles
}

/** Gráfica de área pequeña para el historial reciente. */
export function Sparkline({ data, color, max, height = 56, length = 60 }: Props) {
  const id = useId();
  const w = 300;
  const h = height;
  const top = max ?? Math.max(1, ...data) * 1.15;
  const pts = data.slice(-length);
  const step = w / (length - 1);
  const offset = (length - pts.length) * step;

  const coords = pts.map((v, i) => [offset + i * step, h - (Math.min(v, top) / top) * (h - 4) - 2] as const);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = coords.length ? `${line} L${w},${h} L${coords[0][0]},${h} Z` : "";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {coords.length > 1 && (
        <>
          <path d={area} fill={`url(#s${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"
            strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
