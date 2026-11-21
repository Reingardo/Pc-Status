// Compila el sidecar .NET (sensors/) y lo copia a src-tauri/binaries con el
// nombre que exige Tauri: pc-sensors-<target-triple>.exe
// Uso: node scripts/build-sensors.mjs [--force]
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const triple = "x86_64-pc-windows-msvc";
const dest = join(root, "src-tauri", "binaries", `pc-sensors-${triple}.exe`);

if (existsSync(dest) && !process.argv.includes("--force")) {
  console.log("[sensors] ya compilado:", dest);
  process.exit(0);
}

console.log("[sensors] compilando sidecar .NET...");
execSync(`dotnet publish "${join(root, "sensors")}" -c Release -o "${join(root, "sensors", "publish")}"`, {
  stdio: "inherit",
});
mkdirSync(join(root, "src-tauri", "binaries"), { recursive: true });
copyFileSync(join(root, "sensors", "publish", "pc-sensors.exe"), dest);
console.log("[sensors] listo:", dest);
