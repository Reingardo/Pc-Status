//! Proceso de sensores: sidecar .NET (`pc-sensors.exe`) con LibreHardwareMonitor.
//!
//! **Mínimo privilegio.** La ventana de PC Status se ejecuta SIN permisos de administrador.
//! Solo el sidecar, que únicamente lee sensores, se lanza elevado (aviso de UAC), porque
//! LibreHardwareMonitor necesita administrador para leer temperaturas de CPU, ventiladores
//! y voltajes a través del driver PawnIO. La interfaz, el speedtest y la lista de procesos
//! nunca corren elevados.
//!
//! Un proceso elevado no puede heredar el stdin/stdout de la app, así que los dos procesos
//! se comunican por un named pipe local:
//! - nombre aleatorio por arranque, una sola instancia y solo clientes locales;
//! - la app es el servidor y acepta una única conexión (la del sidecar que lanzó);
//! - el sidecar termina al recibir `quit` o en cuanto la app cierra el pipe.
//!
//! Si el usuario rechaza el UAC (o en desarrollo), el sidecar se lanza sin elevar
//! y la app muestra el aviso de que faltan permisos para algunos sensores.

use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, WriteHalf};
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};

use crate::CREATE_NO_WINDOW;

/// Tiempo máximo para que el sidecar se conecte al pipe después de lanzarlo.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);

/// Estado compartido con el proceso de sensores.
#[derive(Default)]
pub struct Sensors {
    /// Canal para mandar órdenes al sidecar (`inventory`, `quit`).
    writer: tokio::sync::Mutex<Option<WriteHalf<NamedPipeServer>>>,
    /// Último inventario de hardware recibido (JSON), para la vista "Mi PC".
    inventory: Arc<Mutex<Option<String>>>,
    /// Sube cada vez que se (re)inicia el sidecar; el lector de un proceso viejo no avisa de errores.
    generation: Arc<AtomicU64>,
}

/// `pc-sensors.exe` está junto al ejecutable de la app.
fn sidecar_path() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe.parent().ok_or("sin carpeta del ejecutable")?.join("pc-sensors.exe"))
}

/// Nombre de pipe distinto en cada arranque.
fn pipe_name() -> String {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("pc-status-sensors-{}-{nanos:x}", std::process::id())
}

/// Lanza el sidecar con UAC. Devuelve `false` si el usuario lo rechaza o falla.
#[cfg_attr(debug_assertions, allow(dead_code))]
fn launch_elevated(path: &Path, pipe: &str) -> bool {
    let script = format!(
        "Start-Process -FilePath '{}' -ArgumentList '--pipe','{}' -Verb RunAs -WindowStyle Hidden",
        path.display().to_string().replace('\'', "''"),
        pipe
    );
    Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Lanza el sidecar: elevado en release (si el usuario acepta) y sin elevar si no.
fn launch(path: &Path, pipe: &str) -> Result<(), String> {
    #[cfg(not(debug_assertions))]
    if launch_elevated(path, pipe) {
        return Ok(());
    }
    Command::new(path)
        .args(["--pipe", pipe])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("no se pudo iniciar {}: {e}", path.display()))
}

/// Crea el pipe, lanza el sidecar y reenvía su salida a la interfaz:
/// - líneas de inventario → se guardan y se emiten como evento `inventory`
/// - el resto (lecturas por segundo) → evento `sensors`
pub async fn spawn(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Sensors>();
    let gen = state.generation.fetch_add(1, Ordering::SeqCst) + 1;

    let name = pipe_name();
    let server = ServerOptions::new()
        .first_pipe_instance(true) // nadie más puede haber creado un pipe con este nombre
        .max_instances(1) // una sola conexión: la del sidecar
        .reject_remote_clients(true)
        .create(format!(r"\\.\pipe\{name}"))
        .map_err(|e| format!("no se pudo crear el canal de sensores: {e}"))?;

    let path = sidecar_path()?;
    tauri::async_runtime::spawn_blocking(move || launch(&path, &name))
        .await
        .map_err(|e| e.to_string())??;

    tokio::time::timeout(CONNECT_TIMEOUT, server.connect())
        .await
        .map_err(|_| "El proceso de sensores no respondió.".to_string())?
        .map_err(|e| e.to_string())?;

    let (reader, writer) = tokio::io::split(server);
    *state.writer.lock().await = Some(writer);

    let inventory = state.inventory.clone();
    let generation = state.generation.clone();
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
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
        if generation.load(Ordering::SeqCst) == gen {
            let _ = handle.emit("sensors-error", "El proceso de sensores se detuvo.");
        }
    });
    Ok(())
}

/// Pide al sidecar actual que termine.
async fn stop(state: &Sensors) {
    if let Some(mut w) = state.writer.lock().await.take() {
        let _ = w.write_all(b"quit\n").await;
        let _ = w.flush().await;
    }
}

/// Detiene el sidecar actual y arranca uno nuevo (p. ej. tras instalar PawnIO).
pub async fn restart(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<Sensors>();
    // Subir la generación primero: así el lector del proceso viejo no avisa de error.
    state.generation.fetch_add(1, Ordering::SeqCst);
    stop(&state).await;
    spawn(app.clone()).await
}

/// Al cerrar la app.
pub fn shutdown(app: &AppHandle) {
    let state = app.state::<Sensors>();
    state.generation.fetch_add(1, Ordering::SeqCst);
    tauri::async_runtime::block_on(stop(&state));
}

/// Devuelve el último inventario de hardware (o null si aún no ha llegado).
#[tauri::command]
pub fn get_inventory(state: State<Sensors>) -> Option<String> {
    state.inventory.lock().unwrap().clone()
}

/// Pide al sidecar que vuelva a detectar el hardware; llegará por el evento `inventory`.
#[tauri::command]
pub async fn refresh_inventory(state: State<'_, Sensors>) -> Result<(), String> {
    let mut guard = state.writer.lock().await;
    let w = guard.as_mut().ok_or("el proceso de sensores no está activo")?;
    w.write_all(b"inventory\n").await.map_err(|e| e.to_string())?;
    w.flush().await.map_err(|e| e.to_string())
}
