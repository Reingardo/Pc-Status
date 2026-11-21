# PC Status — guía para Claude

Monitor de hardware para Windows al estilo NZXT CAM, con diseño propio. Repo público: https://github.com/Reingardo/Pc-Status (rama `main`, licencia MIT).

**Idioma:** el usuario habla español. Responde siempre en español. El README, las notas de versión y los mensajes de la app en español también.

## Arquitectura

- **Interfaz** (`src/`): React 19, Vite 8, Tailwind v4 (`@theme` + variables CSS) y Motion (`motion/react`).
- **App de escritorio** (`src-tauri/`): Tauri 2 en Rust. Ventana sin bordes (`decorations: false`) y instalador NSIS.
- **Sensores** (`sensors/`): sidecar .NET 10 (`pc-sensors.exe`) que usa LibreHardwareMonitorLib 0.9.6 y WMI.
  - Cada segundo escribe por stdout una línea JSON con la lectura de los sensores.
  - Si recibe la línea `inventory` por stdin, responde con el inventario del PC.
  - Rust lo lanza como `externalBin` y reenvía los datos a la interfaz como eventos.
- **Speedtest** (`src-tauri/src/speedtest.rs`): `reqwest` contra speed.cloudflare.com. `/meta` necesita la cabecera `Referer`.
- **Procesos** (`src-tauri/src/processes.rs`): `sysinfo` 0.40. Hay una lista `PROTECTED` de procesos que no se pueden finalizar; los pid ≤ 4 tampoco.
- **Alertas** (`src/lib/alerts.ts`): se calculan en la interfaz y se notifican con `tauri-plugin-notification`. Se guardan en localStorage.
- **PawnIO**: LibreHardwareMonitor lo necesita desde la 0.9.5 para leer la temperatura de la CPU, los ventiladores y los voltajes.
  - `scripts/fetch-pawnio.mjs` descarga el instalador oficial 2.2.0, verifica su SHA-256 y lo incluye como recurso.
  - La app ofrece un botón "Instalar PawnIO".
  - No intentes instalar drivers desde la terminal: el usuario lo hace desde la app.

## Comandos

```bash
npm run dev          # solo interfaz en el navegador (modo demo, puerto 1420)
npm run app          # app completa en desarrollo (compila el sidecar si hace falta)
npm run app:build    # instalador de release
npx tsc --noEmit     # comprobar tipos
cargo test --manifest-path src-tauri/Cargo.toml                                   # tests de Rust
cargo test --manifest-path src-tauri/Cargo.toml speedtest -- --ignored --nocapture # speedtest real
```

- En las terminales de las herramientas, refresca el PATH desde el registro antes de llamar a `cargo` o `dotnet`.
- Cierra la app de desarrollo antes de compilar, o cargo da "Access is denied".
- Las builds de release piden administrador (`app.manifest`, solo en release). La terminal de la herramienta no puede lanzarlas directamente: ábrelas con `explorer.exe` sobre el acceso directo `.lnk`.

## Modo demo (navegador)

Sin Tauri, la app usa datos simulados (`src/lib/demo.ts`). Estos parámetros de URL sirven para probar y para las capturas:

| Parámetro | Efecto |
|---|---|
| `?view=` | abre una pestaña: `mypc`, `processes`, `speedtest` o `alerts` |
| `?theme=` | aplica un tema |
| `?lang=` | fuerza un idioma |
| `?settings` | abre el panel de ajustes |
| `?autostart` | lanza un speedtest simulado |
| `?hot` | simula una CPU caliente |
| `?nopawnio` | simula que falta PawnIO |

## Convenciones

- **Idiomas** (`src/lib/i18n.tsx`): `es` es el diccionario de referencia y define el tipo `Dict`, así que cualquier texto nuevo va primero en `es` y luego en los otros 8 idiomas (en, pt, fr, de, it, ru, zh, ja). En la interfaz no se escriben textos fijos: siempre `useT()`.
- **Etiquetas largas**: otros idiomas tienen palabras más largas; usa `truncate` y `min-w-0` para que no se solapen.
- **Temas** (`src/lib/themes.ts`): 6 temas definidos con variables CSS. Los colores salen de esas variables, no de valores fijos.
- **React StrictMode** ejecuta dos veces los updaters de estado: nunca hagas efectos secundarios (guardar, notificar) dentro de `setState`.
- **Versión**: al publicar una versión nueva, cámbiala en estos sitios:
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
  - `sensors/PcSensors.csproj`

  Después ejecuta `cargo check` para que se actualice `Cargo.lock`.
- **Commits**: usan la identidad local del repo (Reingardo con su correo noreply de GitHub). No cambies la configuración de git.

## Publicar una versión

1. Sube la versión en los cuatro archivos, haz commit y push a `main`. GitHub Actions (`.github/workflows/release.yml`) compila el instalador como artefacto.
2. Crea y sube el tag `vX.Y.Z`. Actions compila el instalador y crea un release en **borrador** con `PC-Status_x64-setup.exe` (no cambies ese nombre: el README enlaza a `releases/latest`).
3. **Antes de publicar, comprueba siempre la firma del instalador** (`Get-AuthenticodeSignature`) y díselo al usuario. Es una petición expresa suya.
4. Revisa el borrador, añade las notas en español (con capturas y el SHA-256) y publícalo.

**Firma de código:** todavía no hay firma.
- Se solicitó SignPath Foundation; Azure Trusted Signing no está disponible para particulares en México.
- Cuando SignPath lo apruebe, hay que configurar:
  - en SignPath, el proyecto `pc-status` y la política `release-signing`;
  - en GitHub, el secreto `SIGNPATH_API_TOKEN` y la variable `SIGNPATH_ORGANIZATION_ID`.
- El workflow ya firma solo cuando esa variable existe.
- Ver `CODE_SIGNING_POLICY.md`.

## Capturas del README

- Las capturas de `docs/screenshots/` se generan **solo con el modo demo**, nunca con datos reales del PC del usuario (privacidad).
- Se hacen con Edge en modo headless usando `--virtual-time-budget` y los parámetros de URL de arriba.
