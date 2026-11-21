// Descarga el instalador oficial de PawnIO (driver que LibreHardwareMonitor necesita
// para leer temperaturas de CPU, ventiladores y voltajes) y comprueba su SHA-256.
// Se incluye en el instalador de PC Status; la app lo ejecuta solo si el usuario
// pulsa "Instalar PawnIO".
//
// Origen: https://github.com/namazso/PawnIO.Setup/releases (namazso, autor de PawnIO)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VERSION = "2.2.0";
const SHA256 = "1f519a22e47187f70a1379a48ca604981c4fcf694f4e65b734aaa74a9fba3032";
const URL = `https://github.com/namazso/PawnIO.Setup/releases/download/${VERSION}/PawnIO_setup.exe`;

const dir = join(import.meta.dirname, "..", "src-tauri", "resources");
const dest = join(dir, "PawnIO_setup.exe");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

if (existsSync(dest) && sha(readFileSync(dest)) === SHA256) {
  console.log(`[pawnio] ya descargado (${VERSION})`);
  process.exit(0);
}

console.log(`[pawnio] descargando PawnIO ${VERSION}…`);
const res = await fetch(URL);
if (!res.ok) throw new Error(`[pawnio] descarga fallida: HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
if (sha(buf) !== SHA256) throw new Error("[pawnio] el SHA-256 no coincide: archivo rechazado");

mkdirSync(dir, { recursive: true });
writeFileSync(dest, buf);
console.log(`[pawnio] listo: ${dest}`);
