// Temas de PC Status. Cada tema define TODAS las variables de estilo:
// colores, esquinas, brillo, fuentes, fondo y aspecto de las tarjetas.
// Para crear tu propio tema, copia uno de abajo y cambia los valores.

export interface Theme {
  id: string;
  name: string;
  description: string;
  vars: Record<string, string>;
}

const FONT_SPACE = `"Space Grotesk Variable", "Segoe UI Variable Display", system-ui, sans-serif`;
const FONT_INTER = `"Inter Variable", "Segoe UI Variable Text", system-ui, sans-serif`;
const FONT_ORBITRON = `"Orbitron Variable", ${FONT_SPACE}`;
const FONT_MONO = `"JetBrains Mono Variable", Consolas, monospace`;

const darkTints = {
  "--color-tint": "rgb(255 255 255 / 0.04)",
  "--color-tint-2": "rgb(255 255 255 / 0.08)",
  "--color-line": "rgb(255 255 255 / 0.08)",
  "--color-inset": "rgb(0 0 0 / 0.22)",
};

export const THEMES: Theme[] = [
  {
    id: "neon",
    name: "Neón",
    description: "Vidrio oscuro con brillos cian y violeta",
    vars: {
      "--color-bg": "#07090f", "--color-track": "#161b27", "--color-fg": "#e8ecf4", "--color-muted": "#7c869b",
      "--color-cpu": "#22d3ee", "--color-cpu-2": "#3b82f6",
      "--color-gpu": "#a855f7", "--color-gpu-2": "#ec4899",
      "--color-ram": "#f472b6", "--color-ram-2": "#f59e0b",
      "--color-net": "#34d399", "--color-fan": "#38bdf8", "--color-disk": "#818cf8",
      "--color-ok": "#34d399", "--color-warn": "#fbbf24", "--color-hot": "#f87171",
      ...darkTints,
      "--radius": "16px", "--radius-sm": "12px", "--radius-xs": "6px", "--radius-pill": "999px",
      "--glow": "1",
      "--font-display": FONT_SPACE, "--font-sans": FONT_INTER,
      "--card-bg": "linear-gradient(180deg, rgb(255 255 255 / 0.045), rgb(255 255 255 / 0.015))",
      "--card-border": "rgb(255 255 255 / 0.07)",
      "--card-shadow": "0 1px 0 rgb(255 255 255 / 0.05) inset, 0 20px 40px -20px rgb(0 0 0 / 0.6)",
      "--card-blur": "16px",
      "--app-bg": `radial-gradient(900px 500px at 10% -10%, color-mix(in oklab, var(--color-cpu) 14%, transparent), transparent 60%),
        radial-gradient(800px 500px at 90% 0%, color-mix(in oklab, var(--color-gpu) 14%, transparent), transparent 60%),
        radial-gradient(700px 500px at 50% 120%, color-mix(in oklab, var(--color-ram) 8%, transparent), transparent 60%),
        var(--color-bg)`,
    },
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    description: "Amarillo y magenta, esquinas cortadas y rejilla",
    vars: {
      "--color-bg": "#0b0710", "--color-track": "#221830", "--color-fg": "#f7f2ff", "--color-muted": "#9584ad",
      "--color-cpu": "#fcee0a", "--color-cpu-2": "#ff9f1c",
      "--color-gpu": "#ff2a6d", "--color-gpu-2": "#d300c5",
      "--color-ram": "#05d9e8", "--color-ram-2": "#005fff",
      "--color-net": "#00ff9f", "--color-fan": "#05d9e8", "--color-disk": "#fcee0a",
      "--color-ok": "#00ff9f", "--color-warn": "#fcee0a", "--color-hot": "#ff2a6d",
      "--color-tint": "rgb(255 42 109 / 0.05)", "--color-tint-2": "rgb(255 42 109 / 0.12)",
      "--color-line": "rgb(252 238 10 / 0.16)", "--color-inset": "rgb(0 0 0 / 0.35)",
      "--radius": "2px", "--radius-sm": "2px", "--radius-xs": "1px", "--radius-pill": "2px",
      "--glow": "1.25",
      "--font-display": FONT_ORBITRON, "--font-sans": FONT_INTER,
      "--card-bg": "linear-gradient(135deg, rgb(28 14 40 / 0.92), rgb(12 6 20 / 0.92))",
      // El borde y la sombra usan el color de cada tarjeta: ver [data-theme="cyberpunk"] en index.css
      "--card-border": "rgb(252 238 10 / 0.2)",
      "--card-shadow": "none",
      "--card-blur": "0px",
      "--app-bg": `linear-gradient(rgb(255 42 109 / 0.06) 1px, transparent 1px) 0 0 / 36px 36px,
        linear-gradient(90deg, rgb(255 42 109 / 0.06) 1px, transparent 1px) 0 0 / 36px 36px,
        radial-gradient(900px 500px at 100% 0%, rgb(255 42 109 / 0.18), transparent 60%),
        radial-gradient(800px 500px at 0% 100%, rgb(5 217 232 / 0.12), transparent 60%),
        var(--color-bg)`,
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Plano, gris y sin brillos. Un solo acento azul",
    vars: {
      "--color-bg": "#0c0c0e", "--color-track": "#1f1f23", "--color-fg": "#ededee", "--color-muted": "#85858d",
      "--color-cpu": "#f4f4f5", "--color-cpu-2": "#a1a1aa",
      "--color-gpu": "#60a5fa", "--color-gpu-2": "#2563eb",
      "--color-ram": "#d4d4d8", "--color-ram-2": "#71717a",
      "--color-net": "#60a5fa", "--color-fan": "#a1a1aa", "--color-disk": "#d4d4d8",
      "--color-ok": "#4ade80", "--color-warn": "#facc15", "--color-hot": "#f87171",
      "--color-tint": "rgb(255 255 255 / 0.03)", "--color-tint-2": "rgb(255 255 255 / 0.07)",
      "--color-line": "rgb(255 255 255 / 0.07)", "--color-inset": "rgb(255 255 255 / 0.02)",
      "--radius": "10px", "--radius-sm": "8px", "--radius-xs": "3px", "--radius-pill": "8px",
      "--glow": "0",
      "--font-display": FONT_INTER, "--font-sans": FONT_INTER,
      "--card-bg": "#141416",
      "--card-border": "rgb(255 255 255 / 0.06)",
      "--card-shadow": "none",
      "--card-blur": "0px",
      "--app-bg": "var(--color-bg)",
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Pasteles suaves, muy redondeado y luminoso",
    vars: {
      "--color-bg": "#0a0f24", "--color-track": "#1c2448", "--color-fg": "#eef2ff", "--color-muted": "#8f97bd",
      "--color-cpu": "#5eead4", "--color-cpu-2": "#818cf8",
      "--color-gpu": "#c4b5fd", "--color-gpu-2": "#f0abfc",
      "--color-ram": "#fda4af", "--color-ram-2": "#fdba74",
      "--color-net": "#86efac", "--color-fan": "#7dd3fc", "--color-disk": "#a5b4fc",
      "--color-ok": "#86efac", "--color-warn": "#fde68a", "--color-hot": "#fda4af",
      "--color-tint": "rgb(255 255 255 / 0.05)", "--color-tint-2": "rgb(255 255 255 / 0.1)",
      "--color-line": "rgb(255 255 255 / 0.1)", "--color-inset": "rgb(10 15 36 / 0.35)",
      "--radius": "26px", "--radius-sm": "18px", "--radius-xs": "10px", "--radius-pill": "999px",
      "--glow": "1.6",
      "--font-display": FONT_SPACE, "--font-sans": FONT_INTER,
      "--card-bg": "linear-gradient(160deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02))",
      "--card-border": "rgb(255 255 255 / 0.1)",
      "--card-shadow": "0 1px 0 rgb(255 255 255 / 0.08) inset, 0 30px 60px -30px rgb(0 0 0 / 0.6)",
      "--card-blur": "28px",
      "--app-bg": `radial-gradient(1000px 600px at 0% 0%, rgb(94 234 212 / 0.22), transparent 60%),
        radial-gradient(900px 600px at 100% 10%, rgb(196 181 253 / 0.25), transparent 60%),
        radial-gradient(900px 600px at 50% 110%, rgb(253 164 175 / 0.2), transparent 60%),
        var(--color-bg)`,
    },
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Verde fósforo, monoespaciada y líneas de CRT",
    vars: {
      "--color-bg": "#020602", "--color-track": "#0c1c0c", "--color-fg": "#b9ffb0", "--color-muted": "#4f8a4b",
      "--color-cpu": "#39ff14", "--color-cpu-2": "#1fae0b",
      "--color-gpu": "#39ff14", "--color-gpu-2": "#1fae0b",
      "--color-ram": "#a6ff7a", "--color-ram-2": "#39ff14",
      "--color-net": "#39ff14", "--color-fan": "#7dff5c", "--color-disk": "#39ff14",
      "--color-ok": "#39ff14", "--color-warn": "#ffb000", "--color-hot": "#ff3b3b",
      "--color-tint": "rgb(57 255 20 / 0.04)", "--color-tint-2": "rgb(57 255 20 / 0.1)",
      "--color-line": "rgb(57 255 20 / 0.18)", "--color-inset": "rgb(0 0 0 / 0.4)",
      "--radius": "0px", "--radius-sm": "0px", "--radius-xs": "0px", "--radius-pill": "0px",
      "--glow": "0.7",
      "--font-display": FONT_MONO, "--font-sans": FONT_MONO,
      "--card-bg": "rgb(4 12 4 / 0.9)",
      "--card-border": "rgb(57 255 20 / 0.25)",
      "--card-shadow": "0 0 18px -6px rgb(57 255 20 / 0.25)",
      "--card-blur": "0px",
      "--app-bg": `radial-gradient(1200px 700px at 50% 40%, rgb(57 255 20 / 0.07), transparent 70%), var(--color-bg)`,
    },
  },
  {
    id: "light",
    name: "Claro",
    description: "Fondo claro y limpio para el día",
    vars: {
      "--color-bg": "#eef1f7", "--color-track": "#dde3ee", "--color-fg": "#0f172a", "--color-muted": "#64748b",
      "--color-cpu": "#0891b2", "--color-cpu-2": "#2563eb",
      "--color-gpu": "#7c3aed", "--color-gpu-2": "#db2777",
      "--color-ram": "#db2777", "--color-ram-2": "#ea580c",
      "--color-net": "#059669", "--color-fan": "#0284c7", "--color-disk": "#4f46e5",
      "--color-ok": "#059669", "--color-warn": "#d97706", "--color-hot": "#dc2626",
      "--color-tint": "rgb(15 23 42 / 0.035)", "--color-tint-2": "rgb(15 23 42 / 0.08)",
      "--color-line": "rgb(15 23 42 / 0.09)", "--color-inset": "rgb(15 23 42 / 0.035)",
      "--radius": "16px", "--radius-sm": "12px", "--radius-xs": "6px", "--radius-pill": "999px",
      "--glow": "0.35",
      "--font-display": FONT_SPACE, "--font-sans": FONT_INTER,
      "--card-bg": "#ffffff",
      "--card-border": "rgb(15 23 42 / 0.06)",
      "--card-shadow": "0 1px 2px rgb(15 23 42 / 0.04), 0 12px 32px -16px rgb(15 23 42 / 0.18)",
      "--card-blur": "0px",
      "--app-bg": `radial-gradient(900px 500px at 10% -10%, rgb(8 145 178 / 0.1), transparent 60%),
        radial-gradient(800px 500px at 90% 0%, rgb(124 58 237 / 0.08), transparent 60%), var(--color-bg)`,
    },
  },
];

// ------------------------------------------------------------------ ajustes

export interface Settings {
  theme: string;
  glow: number; // multiplicador del brillo del tema (0–2)
  animations: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: "neon", glow: 1, animations: true };
const KEY = "pcstatus.settings";

export function loadSettings(): Settings {
  let s = DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* sin almacenamiento */ }
  // ?theme=cyberpunk fuerza un tema sin guardarlo (útil para capturas / demos).
  const forced = new URLSearchParams(location.search).get("theme");
  return forced && THEMES.some((t) => t.id === forced) ? { ...s, theme: forced } : s;
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
}

export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** Aplica el tema y los ajustes al documento (variables CSS + atributos). */
export function applySettings(s: Settings) {
  const theme = getTheme(s.theme);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  root.style.setProperty("--glow", String(Number(theme.vars["--glow"]) * s.glow));
  root.dataset.theme = theme.id;
  root.dataset.animations = s.animations ? "on" : "off";
  root.style.colorScheme = theme.id === "light" ? "light" : "dark";
}
