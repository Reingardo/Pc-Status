# Ficha de la Microsoft Store — PC Status

Textos para Partner Center → Store listings. Capturas en `docs/store/es` y `docs/store/en` (modo demo, 1440×900).

- **Política de privacidad:** https://github.com/Reingardo/Pc-Status/blob/main/PRIVACY.md
- **Sitio web:** https://github.com/Reingardo/Pc-Status
- **Soporte:** https://github.com/Reingardo/Pc-Status/issues

---

## Español (es-MX)

**Descripción**

PC Status es un monitor de hardware para Windows con un diseño moderno y personalizable. Ve de un vistazo cómo trabaja tu PC: uso y temperatura de la CPU y la GPU, memoria, núcleos, red, ventiladores y discos, con medidores animados y gráficas en tiempo real.

• Panel en tiempo real: CPU, GPU, RAM, núcleos, red, ventiladores y discos con gráficas de 60 segundos.
• Mi PC: inventario completo del hardware (procesador, gráfica, placa base y BIOS, RAM por ranura, discos, pantallas, red y audio). Avisa si tu RAM funciona por debajo de su velocidad (XMP/EXPO desactivado).
• Procesos: qué aplicaciones consumen CPU, RAM y disco, con buscador y opción para finalizarlas.
• Alertas: notificación de Windows cuando la CPU, la GPU o un disco se calientan demasiado, con historial.
• Speedtest: ping, jitter, descarga y subida con velocímetro e historial.
• 6 temas (Neón, Cyberpunk, Minimal, Aurora, Terminal y Claro) y 9 idiomas.

Sin anuncios, sin cuentas y sin recopilar datos. Código abierto (MIT).

Nota: para leer temperaturas de CPU, ventiladores y voltajes, la app pide permisos de administrador y usa el driver gratuito PawnIO. Si no lo tienes, PC Status te indica cómo instalarlo desde su página oficial.

**Características destacadas** (una por línea)

- Monitoreo en tiempo real de CPU, GPU, RAM, red, ventiladores y discos
- Temperaturas de CPU, GPU y discos con gráficas de 60 segundos
- Inventario completo del hardware de tu PC
- Detecta RAM funcionando por debajo de su velocidad (XMP/EXPO)
- Lista de procesos con consumo de CPU, RAM y disco
- Alertas de temperatura con notificaciones de Windows
- Prueba de velocidad de internet con historial
- 6 temas visuales y 9 idiomas
- Sin anuncios ni recopilación de datos

**Palabras clave:** monitor de hardware, temperatura CPU, temperatura GPU, ventiladores, speedtest, procesos, rendimiento

**Requisitos adicionales del sistema:** Windows 10 u 11 de 64 bits. Permisos de administrador para leer todos los sensores.

---

## English (en-US)

**Description**

PC Status is a hardware monitor for Windows with a modern, customizable design. See at a glance how your PC is doing: CPU and GPU usage and temperature, memory, cores, network, fans and drives, with animated gauges and real-time charts.

• Real-time dashboard: CPU, GPU, RAM, cores, network, fans and drives with 60-second charts.
• My PC: full hardware inventory (processor, graphics, motherboard and BIOS, RAM per slot, drives, displays, network and audio). Warns you if your RAM runs below its rated speed (XMP/EXPO disabled).
• Processes: see which apps use CPU, RAM and disk, with search and the option to end them.
• Alerts: Windows notification when the CPU, GPU or a drive gets too hot, with history.
• Speedtest: ping, jitter, download and upload with a speedometer and history.
• 6 themes (Neon, Cyberpunk, Minimal, Aurora, Terminal and Light) and 9 languages.

No ads, no accounts and no data collection. Open source (MIT).

Note: to read CPU temperatures, fans and voltages, the app asks for administrator rights and uses the free PawnIO driver. If it's missing, PC Status shows you how to install it from its official page.

**Product features**

- Real-time monitoring of CPU, GPU, RAM, network, fans and drives
- CPU, GPU and drive temperatures with 60-second charts
- Full hardware inventory of your PC
- Detects RAM running below its rated speed (XMP/EXPO)
- Process list with CPU, RAM and disk usage
- Temperature alerts with Windows notifications
- Internet speed test with history
- 6 visual themes and 9 languages
- No ads and no data collection

**Keywords:** hardware monitor, CPU temperature, GPU temperature, fans, speedtest, processes, performance

**Additional system requirements:** 64-bit Windows 10 or 11. Administrator rights to read all sensors.

---

## Notas para certificación (Submission options → Notes for certification)

PC Status is a hardware monitor (open source: https://github.com/Reingardo/Pc-Status).

Restricted capabilities:
- runFullTrust: the app is a Win32 desktop app (Tauri/WebView2) that launches a bundled helper process (pc-sensors.exe, .NET + LibreHardwareMonitor) to read hardware sensors.
- allowElevation: reading CPU temperatures, fan speeds and voltages through LibreHardwareMonitor requires administrator rights, so the app requests elevation (UAC) at startup. Without it, only basic usage data is available.

The package does not include or install any driver. LibreHardwareMonitor uses the third-party PawnIO driver; if it is not installed, the app shows a notice and the "Install PawnIO" button opens the official website (https://pawnio.eu/) in the browser. The app works without it (with fewer sensors).

The "Processes" tab can end user processes after a confirmation; critical system processes are protected and cannot be ended.

No account or login is required. No personal data is collected; the speed test connects to speed.cloudflare.com only when the user starts it.

---

## Justificación de `allowElevation` (reenvío 0.2.1, tras el rechazo 10.6.3 del 26/11/2026)

PC Status is an open-source hardware monitor. Source code: https://github.com/Reingardo/Pc-Status — Support: https://github.com/Reingardo/Pc-Status/issues

WHAT CHANGED SINCE THE PREVIOUS SUBMISSION: in version 0.2.1 the app was re-architected for least privilege. The main app (window, speed test, process list) no longer runs elevated: it runs as a normal user (asInvoker). Only a small separate helper process, pc-sensors.exe, is started elevated, through the standard Windows UAC prompt.

1) Why the product requires it. The core feature is showing CPU temperature, fan speeds and voltages. Windows exposes no public user-mode API for these values: they are only readable from hardware registers (CPU model-specific registers, SMBus and the motherboard's Super I/O chip). The app uses the open-source LibreHardwareMonitor library, which reads them through the signed PawnIO driver, and PawnIO only grants that access to processes running as administrator. Alternatives we explored: (a) WMI MSAcpi_ThermalZoneTemperature: not implemented on most desktop motherboards and it reports ACPI zones, not the CPU temperature; (b) Performance counters/PDH, DXGI and GPU vendor APIs: they give usage and GPU data without elevation, but not CPU package temperature, motherboard fans or voltages; (c) a Windows service: not possible in an MSIX package and it would need broader, permanent privileges; (d) no elevation at all: the app still works but without CPU temperature, fans and voltages, which is the main purpose of the product.

2) Functionality that requires it: only the sensor reader (pc-sensors.exe) reading CPU temperature, motherboard fans, voltages and power. Nothing else in the app is elevated.

3) Least privilege. The elevated helper only READS sensors. It does not write files or registry keys (it writes to no path at all), opens no network connections, starts no other processes and has no user interface. It exits as soon as the app closes. The user can decline the UAC prompt and the app keeps working with fewer sensors. The app does not install drivers: if PawnIO is missing, the button only opens its official website.

4) Safeguards against misuse. The app and the helper communicate through a local named pipe with a random name per launch, created by the app as a single instance that rejects remote clients. The helper accepts only two fixed commands ("inventory" to re-read the hardware list and "quit"); it never executes arbitrary commands or paths received from outside. The whole code is open source and can be audited.

5) Statement of assurance: we confirm that allowElevation is used only to start pc-sensors.exe to read hardware sensors as described above, and that the elevated process does not write to any path.
