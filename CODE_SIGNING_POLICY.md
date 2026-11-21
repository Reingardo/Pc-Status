# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

## Qué se firma

- El instalador de Windows `PC-Status_x64-setup.exe` publicado en [Releases](https://github.com/Reingardo/Pc-Status/releases).
- Solo se firman binarios compilados automáticamente por [GitHub Actions](.github/workflows/release.yml) a partir del código fuente de este repositorio. Nunca se firman archivos compilados en un equipo local.
- Cada firma requiere **aprobación manual** de un aprobador del proyecto.

## Roles del equipo

| Rol | Miembros |
|---|---|
| Committers y reviewers | [Reingardo](https://github.com/Reingardo) |
| Approvers | [Reingardo](https://github.com/Reingardo) |

Los cambios de personas ajenas al equipo (pull requests) se revisan antes de integrarse. Todos los miembros usan autenticación multifactor en GitHub y en SignPath.

## Privacidad

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

En concreto:

- **Sensores e inventario**: se leen en el propio PC y no salen de él.
- **Speedtest**: solo cuando el usuario pulsa *Iniciar*, la app se conecta a `speed.cloudflare.com` para medir la velocidad (igual que la web de Cloudflare). Se aplica la [política de privacidad de Cloudflare](https://www.cloudflare.com/privacypolicy/).
- **Historial y ajustes**: se guardan únicamente en el PC del usuario.

## Componentes de terceros

Todos los componentes son de código abierto: [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) (MPL-2.0), [Tauri](https://tauri.app) (MIT / Apache-2.0), .NET runtime (MIT), React (MIT), Motion (MIT), Tailwind CSS (MIT) y fuentes con licencia SIL OFL. Los binarios de terceros incluidos en el instalador no se firman con el certificado de este proyecto.

## Desinstalación

Configuración de Windows → Aplicaciones → PC Status → Desinstalar (o `uninstall.exe` en la carpeta de instalación).
