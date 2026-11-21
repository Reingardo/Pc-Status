use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};

mod speedtest;

/// No abrir ventana de consola para el proceso de sensores.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Estado compartido con el proceso de sensores (sidecar .NET con LibreHardwareMonitor).
#[derive(Default)]
struct Sensors {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    /// Último inventario de hardware recibido (JSON), para la vista "Mi PC".
    inventory: Arc<Mutex<Option<String>>>,
    /// Sube cada vez que se (re)inicia el sidecar; el lector de un proceso viejo no avisa de errores.
    generation: Arc<AtomicU64>,
}

/// Lanza `pc-sensors.exe` (está junto al ejecutable de la app) y reenvía su salida:
/// - líneas de inventario → se guardan y se emiten como evento `inventory`
/// - el resto (lecturas por segundo) → evento `sensors`
fn start_sensors(
    app: &AppHandle,
    inventory: Arc<Mutex<Option<String>>>,
    generation: Arc<AtomicU64>,
    my_gen: u64,
) -> Result<Child, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let path = exe
        .parent()
        .ok_or("sin carpeta del ejecutable")?
        .join("pc-sensors.exe");

    let mut child = Command::new(&path)
        .stdin(Stdio::piped()) // órdenes para el sidecar; si la app muere, ve EOF y se cierra
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("no se pudo iniciar {}: {e}", path.display()))?;

    let stdout = child.stdout.take().ok_or("sin stdout")?;
    let handle = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            if line.trim().is_empty() {
                continue;
            }
            if line.starts_with(r#"{"kind":"inventory""#) {
                *inventory.lock().unwrap() = Some(line.clone());
                let _ = handle.emit("inventory", line);
            } else {
                let _ = handle.emit("sensors", line);
            }
        }
        if generation.load(Ordering::SeqCst) == my_gen {
            let _ = handle.emit("sensors-error", "El proceso de sensores se detuvo.");
        }
    });

    Ok(child)
}

/// Devuelve el último inventario de hardware (o null si aún no ha llegado).
#[tauri::command]
fn get_inventory(state: State<Sensors>) -> Option<String> {
    state.inventory.lock().unwrap().clone()
}

/// Pide al sidecar que vuelva a detectar el hardware; llegará por el evento `inventory`.
#[tauri::command]
fn refresh_inventory(state: State<Sensors>) -> Result<(), String> {
    let mut guard = state.stdin.lock().unwrap();
    let stdin = guard.as_mut().ok_or("el proceso de sensores no está activo")?;
    stdin
        .write_all(b"inventory\n")
        .and_then(|_| stdin.flush())
        .map_err(|e| e.to_string())
}

/// Lanza el sidecar y lo guarda en el estado (al arrancar y al reiniciarlo).
fn spawn_sensors(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<Sensors>();
    let gen = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let mut child = start_sensors(app, state.inventory.clone(), state.generation.clone(), gen)?;
    *state.stdin.lock().unwrap() = child.stdin.take();
    *state.child.lock().unwrap() = Some(child);
    Ok(())
}

/// Detiene el sidecar actual y arranca uno nuevo (p. ej. tras instalar PawnIO).
fn restart_sensors(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<Sensors>();
    // Subir la generación primero: así el hilo lector del proceso viejo no avisa de error.
    state.generation.fetch_add(1, Ordering::SeqCst);
    drop(state.stdin.lock().unwrap().take());
    let old = state.child.lock().unwrap().take();
    if let Some(mut c) = old {
        let _ = c.kill();
        let _ = c.wait();
    }
    spawn_sensors(app)
}

/// Ejecuta el instalador oficial de PawnIO incluido con la app. Windows pide permiso
/// al usuario (UAC). Al terminar, reinicia el sidecar para que detecte el driver.
#[tauri::command]
async fn install_pawnio(app: AppHandle) -> Result<(), String> {
    let setup = app
        .path()
        .resolve("PawnIO_setup.exe", BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    if !setup.exists() {
        return Err(format!("No se encuentra el instalador de PawnIO en {}", setup.display()));
    }

    // Start-Process -Verb RunAs muestra el aviso de UAC aunque la app no sea administradora.
    let script = format!(
        "$p = Start-Process -FilePath '{}' -ArgumentList '-install' -Verb RunAs -Wait -PassThru; exit $p.ExitCode",
        setup.display().to_string().replace('\'', "''")
    );
    let status = tauri::async_runtime::spawn_blocking(move || {
        Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("La instalación de PawnIO se canceló o falló.".into());
    }
    restart_sensors(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Sensors::default())
        .manage(speedtest::SpeedTest::default())
        .invoke_handler(tauri::generate_handler![
            get_inventory,
            refresh_inventory,
            speedtest::start_speedtest,
            speedtest::cancel_speedtest,
            install_pawnio,
        ])
        .setup(|app| {
            match spawn_sensors(app.handle()) {
                Ok(()) => {}
                Err(e) => {
                    eprintln!("[pc-status] {e}");
                    let h = app.handle().clone();
                    // Avisar al frontend cuando ya esté escuchando.
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(2));
                        let _ = h.emit("sensors-error", e);
                    });
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error al iniciar PC Status")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                let state = app.state::<Sensors>();
                drop(state.stdin.lock().unwrap().take());
                let child = state.child.lock().unwrap().take();
                if let Some(mut c) = child {
                    let _ = c.kill();
                }
            }
        });
}
