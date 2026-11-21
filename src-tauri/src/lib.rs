use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};

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
}

/// Lanza `pc-sensors.exe` (está junto al ejecutable de la app) y reenvía su salida:
/// - líneas de inventario → se guardan y se emiten como evento `inventory`
/// - el resto (lecturas por segundo) → evento `sensors`
fn start_sensors(app: &AppHandle, inventory: Arc<Mutex<Option<String>>>) -> Result<Child, String> {
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
        let _ = handle.emit("sensors-error", "El proceso de sensores se detuvo.");
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
        ])
        .setup(|app| {
            let state = app.state::<Sensors>();
            match start_sensors(app.handle(), state.inventory.clone()) {
                Ok(mut child) => {
                    *state.stdin.lock().unwrap() = child.stdin.take();
                    *state.child.lock().unwrap() = Some(child);
                }
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
