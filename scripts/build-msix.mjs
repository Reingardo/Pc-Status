// Empaqueta PC Status como MSIX para la Microsoft Store.
//
// Usa la build de release ya compilada (npm run app:build) y genera
// src-tauri/target/release/msix/PC-Status_x64.msix sin firmar: la Store lo firma
// al publicarlo. Necesita makeappx.exe del Windows SDK.
//
// El paquete NO incluye el instalador de PawnIO: las apps de la Store no pueden
// traer drivers. En ese caso el botón "Instalar PawnIO" abre la página oficial.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const release = join(root, "src-tauri", "target", "release");
const out = join(release, "msix");
const layout = join(out, "layout");

const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`[msix] versión no válida: ${version}`);

// Archivos de la app: el ejecutable y el sidecar de sensores
const files = { "pc-status.exe": "pc-status.exe", "pc-sensors.exe": "pc-sensors.exe" };
for (const src of Object.keys(files)) {
  if (!existsSync(join(release, src))) throw new Error(`[msix] falta ${src}: ejecuta antes npm run app:build`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(layout, "Assets"), { recursive: true });

for (const [src, dest] of Object.entries(files)) copyFileSync(join(release, src), join(layout, dest));

const icons = join(root, "src-tauri", "icons");
for (const a of ["StoreLogo.png", "Square44x44Logo.png", "Square150x150Logo.png"]) {
  copyFileSync(join(icons, a), join(layout, "Assets", a));
}

// La Store exige versión de 4 partes con la última en 0
const manifest = readFileSync(join(root, "src-tauri", "msix", "AppxManifest.xml"), "utf8")
  .replace("{{VERSION}}", `${version}.0`);
writeFileSync(join(layout, "AppxManifest.xml"), manifest);

const msix = join(out, "PC-Status_x64.msix");
execFileSync(findMakeAppx(), ["pack", "/o", "/d", layout, "/p", msix], { stdio: "inherit" });
console.log(`[msix] listo: ${msix}`);

/** Busca makeappx.exe en el Windows SDK más reciente. */
function findMakeAppx() {
  const bin = "C:\\Program Files (x86)\\Windows Kits\\10\\bin";
  const sdks = existsSync(bin)
    ? readdirSync(bin).filter((d) => /^10\./.test(d)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    : [];
  for (const sdk of sdks) {
    const exe = join(bin, sdk, "x64", "makeappx.exe");
    if (existsSync(exe)) return exe;
  }
  throw new Error("[msix] no se encuentra makeappx.exe: instala el Windows SDK");
}
