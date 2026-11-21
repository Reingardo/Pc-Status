export const fmt = (v: number | null | undefined, unit = "", digits = 0) =>
  v == null ? "—" : `${v.toFixed(digits)}${unit}`;

export const fmtSpeed = (bytesPerSec: number | null | undefined) => {
  if (bytesPerSec == null) return "—";
  const bits = bytesPerSec * 8;
  if (bits >= 1e9) return `${(bits / 1e9).toFixed(2)} Gb/s`;
  if (bits >= 1e6) return `${(bits / 1e6).toFixed(1)} Mb/s`;
  if (bits >= 1e3) return `${(bits / 1e3).toFixed(0)} Kb/s`;
  return `${bits.toFixed(0)} b/s`;
};

export const fmtGHz = (mhz: number | null | undefined) =>
  mhz == null ? "—" : `${(mhz / 1000).toFixed(2)} GHz`;

/** Color según temperatura: frío → templado → caliente. */
export const tempColor = (t: number | null | undefined) => {
  if (t == null) return "var(--color-muted)";
  if (t < 55) return "var(--color-ok)";
  if (t < 75) return "var(--color-warn)";
  return "var(--color-hot)";
};
