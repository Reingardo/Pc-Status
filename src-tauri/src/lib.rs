use std::os::windows::process::CommandExt;
use std::process::Command;

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, RunEvent};

mod processes;
mod sensors;
mod speedtest;

/// No abrir ventana de consola para los procesos auxiliares.
pub(crate) const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Página oficial de PawnIO, para la versión de la Microsoft Store (que no incluye el instalador).
const PAWNIO_URL: &str = "https://pawnio.eu/";

/// Ejecuta el instalador oficial de PawnIO incluido con la app. Windows pide permiso
/// al usuario (UAC). Al terminar, reinicia el sidecar para que detecte el driver.
///
/// El paquete MSIX de la Microsoft Store no incluye drivers ni su instalador: en ese
/// caso abre la página oficial de PawnIO en el navegador y devuelve `"opened"`.
#[tauri::command]
async fn install_pawnio(app: AppHandle) -> Result<&'static str, String> {
    let setup = app
        .path()
        .resolve("PawnIO_setup.exe", BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    if !setup.exists() {
        Command::new("explorer.exe")
            .arg(PAWNIO_URL)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok("opened");
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
    sensors::restart(&app).await?;
    Ok("installed")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(sensors::Sensors::default())
        .manage(speedtest::SpeedTest::default())
        .manage(processes::Processes::default())
        .invoke_handler(tauri::generate_handler![
            sensors::get_inventory,
            sensors::refresh_inventory,
            speedtest::start_speedtest,
            speedtest::cancel_speedtest,
            install_pawnio,
            processes::list_processes,
            processes::kill_processes,
        ])
        .setup(|app| {
            // El sidecar se lanza en segundo plano: puede esperar al aviso de UAC.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = sensors::spawn(handle.clone()).await {
                    eprintln!("[pc-status] {e}");
                    // Dar tiempo a que la interfaz esté escuchando.
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    let _ = handle.emit("sensors-error", e);
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error al iniciar PC Status")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                sensors::shutdown(app);
            }
        });
}
