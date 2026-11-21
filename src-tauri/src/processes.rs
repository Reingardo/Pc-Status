//! Lista de procesos (CPU, RAM y disco) y opción de finalizarlos.
//!
//! Se guarda un `System` de sysinfo entre llamadas: el % de CPU y los bytes de
//! disco de cada proceso se calculan respecto a la lectura anterior.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System};
use tauri::State;

/// Procesos que nunca se dejan finalizar: cerrarlos cuelga o reinicia Windows.
const PROTECTED: &[&str] = &[
    "system", "registry", "idle", "smss.exe", "csrss.exe", "wininit.exe", "winlogon.exe",
    "services.exe", "lsass.exe", "lsaiso.exe", "svchost.exe", "fontdrvhost.exe", "dwm.exe",
    "memory compression", "secure system", "sihost.exe", "explorer.exe", "msmpeng.exe",
    "pc-status.exe", "pc-sensors.exe",
];

#[derive(Default)]
pub struct Processes(Mutex<Option<(System, Instant)>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcInfo {
    pid: u32,
    name: String,
    exe: Option<String>,
    /// % del total de la CPU (0–100, ya dividido entre los hilos).
    cpu: f32,
    /// Bytes de RAM.
    memory: u64,
    /// Bytes/s de disco (lectura + escritura) desde la lectura anterior.
    disk: f64,
    protected: bool,
}

fn is_protected(name: &str, pid: u32) -> bool {
    pid <= 4 || pid == std::process::id() || PROTECTED.contains(&name.to_lowercase().as_str())
}

/// Devuelve todos los procesos con su consumo actual.
#[tauri::command]
pub fn list_processes(state: State<'_, Processes>) -> Result<Vec<ProcInfo>, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    collect(&mut guard)
}

fn collect(guard: &mut Option<(System, Instant)>) -> Result<Vec<ProcInfo>, String> {
    let first = guard.is_none();
    if first {
        *guard = Some((System::new().map_err(|e| e.to_string())?, Instant::now()));
    }
    let (sys, last) = guard.as_mut().unwrap();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let secs = last.elapsed().as_secs_f64().max(0.2);
    *last = Instant::now();

    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1) as f32;
    let mut out: Vec<ProcInfo> = sys
        .processes()
        .values()
        .map(|p| {
            let name = p.name().to_string_lossy().into_owned();
            let pid = p.pid().as_u32();
            let du = p.disk_usage();
            ProcInfo {
                protected: is_protected(&name, pid),
                pid,
                exe: p.exe().map(|e| e.display().to_string()),
                // La primera lectura no tiene referencia: CPU y disco en 0.
                cpu: if first { 0.0 } else { (p.cpu_usage() / threads).min(100.0) },
                memory: p.memory(),
                disk: if first { 0.0 } else { (du.read_bytes + du.written_bytes) as f64 / secs },
                name,
            }
        })
        .collect();
    out.sort_by(|a, b| b.cpu.total_cmp(&a.cpu).then(b.memory.cmp(&a.memory)));
    Ok(out)
}

/// Finaliza los procesos indicados (todos los de una app si se agrupan).
/// Devuelve cuántos se cerraron.
#[tauri::command]
pub fn kill_processes(state: State<'_, Processes>, pids: Vec<u32>) -> Result<usize, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let (sys, _) = guard.as_ref().ok_or("la lista de procesos aún no se ha cargado")?;
    let procs: HashMap<Pid, &sysinfo::Process> = sys.processes().iter().map(|(k, v)| (*k, v)).collect();

    let mut killed = 0;
    let mut errors = Vec::new();
    for pid in pids {
        let Some(p) = procs.get(&Pid::from_u32(pid)) else { continue };
        let name = p.name().to_string_lossy();
        if is_protected(&name, pid) {
            errors.push(format!("{name} (protegido)"));
            continue;
        }
        if p.kill() {
            killed += 1;
        } else {
            errors.push(name.into_owned());
        }
    }
    if killed == 0 && !errors.is_empty() {
        return Err(errors.join(", "));
    }
    Ok(killed)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Lee los procesos reales dos veces (la segunda ya tiene % de CPU).
    /// cargo test processes -- --nocapture
    #[test]
    fn lists_real_processes() {
        let mut state = None;
        collect(&mut state).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let list = collect(&mut state).unwrap();
        assert!(list.len() > 20, "muy pocos procesos: {}", list.len());
        assert!(list.iter().any(|p| p.protected), "debería haber procesos protegidos");
        for p in list.iter().take(5) {
            println!("{:>6}  {:<28} cpu {:>5.1}%  ram {:>6} MB  disco {:>8.0} B/s  {}",
                p.pid, p.name, p.cpu, p.memory / 1_048_576, p.disk, if p.protected { "protegido" } else { "" });
        }
        println!("total: {} procesos", list.len());
    }
}
