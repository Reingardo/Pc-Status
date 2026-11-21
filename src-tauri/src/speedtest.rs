//! Prueba de velocidad de internet contra los servidores de Cloudflare
//! (los mismos que usa speed.cloudflare.com).
//!
//! Fases: info del proveedor → ping/jitter → descarga → subida.
//! El progreso se envía a la interfaz con el evento `speedtest`.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::{future::join_all, stream, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};

const BASE: &str = "https://speed.cloudflare.com";
const PING_SAMPLES: usize = 15;
const DOWNLOAD_STREAMS: usize = 6;
const UPLOAD_STREAMS: usize = 4;
/// Los primeros segundos (arranque de TCP) no cuentan para el resultado final.
const WARMUP: Duration = Duration::from_millis(1500);

#[derive(Default)]
pub struct SpeedTest {
    running: AtomicBool,
    cancel: Arc<AtomicBool>,
}

#[derive(Deserialize, Clone, Copy)]
pub struct Options {
    download: bool,
    upload: bool,
    /// Duración de cada fase (descarga / subida) en segundos.
    seconds: u64,
}

#[tauri::command]
pub async fn start_speedtest(app: AppHandle, state: State<'_, SpeedTest>, options: Options) -> Result<(), String> {
    if state.running.swap(true, Ordering::SeqCst) {
        return Err("Ya hay una prueba en curso".into());
    }
    state.cancel.store(false, Ordering::SeqCst);
    let emit = |v: Value| { let _ = app.emit("speedtest", v); };
    let result = run(&emit, state.cancel.clone(), options).await;
    state.running.store(false, Ordering::SeqCst);

    if let Err(e) = &result {
        let _ = app.emit("speedtest", json!({ "phase": "error", "message": e }));
    }
    result
}

#[tauri::command]
pub fn cancel_speedtest(state: State<'_, SpeedTest>) {
    state.cancel.store(true, Ordering::SeqCst);
}

/// Destino del progreso (la ventana en la app, o la consola en los tests).
type Emit<'a> = &'a (dyn Fn(Value) + Sync);

async fn run(app: Emit<'_>, cancel: Arc<AtomicBool>, opt: Options) -> Result<(), String> {
    let seconds = opt.seconds.clamp(3, 30);
    let client = reqwest::Client::builder()
        .user_agent(concat!("PC-Status/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(seconds + 20))
        .build()
        .map_err(|e| e.to_string())?;
    let cancelled = || cancel.load(Ordering::Relaxed);

    // --- 1. Proveedor y servidor ---
    app(json!({ "phase": "meta" }));
    let meta: Value = client
        .get(format!("{BASE}/meta"))
        .header("Referer", "https://speed.cloudflare.com/")
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("No hay conexión con el servidor de prueba: {e}"))?
        .json()
        .await
        .unwrap_or(Value::Null);
    app(json!({
        "phase": "meta",
        "isp": meta["asOrganization"],
        "ip": meta["clientIp"],
        "city": meta["city"],
        "country": meta["country"],
        "server": meta["colo"]["city"].as_str().or(meta["colo"].as_str()),
        "serverCode": meta["colo"]["iata"],
    }));

    // --- 2. Ping y jitter ---
    let mut pings: Vec<f64> = Vec::new();
    for i in 0..PING_SAMPLES + 2 {
        if cancelled() { return cancelled_result(app); }
        let t = Instant::now();
        let resp = client
            .get(format!("{BASE}/__down?bytes=0"))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let server_ms = server_time_ms(resp.headers());
        let _ = resp.bytes().await;
        let ms = (t.elapsed().as_secs_f64() * 1000.0 - server_ms).max(0.5);
        if i >= 2 {
            // las dos primeras abren la conexión (TLS): no cuentan
            pings.push(ms);
            app(json!({ "phase": "ping", "value": ms, "progress": pings.len() as f64 / PING_SAMPLES as f64 }));
        }
    }
    let ping = median(&pings);
    let jitter = if pings.len() > 1 {
        pings.windows(2).map(|w| (w[1] - w[0]).abs()).sum::<f64>() / (pings.len() - 1) as f64
    } else {
        0.0
    };
    app(json!({ "phase": "ping-done", "ping": ping, "jitter": jitter }));

    // --- 3. Descarga ---
    let mut download = None;
    if opt.download {
        let d = measure(app, &cancel, "download", seconds, |bytes, deadline| {
            let client = client.clone();
            let cancel = cancel.clone();
            async move {
                while Instant::now() < deadline && !cancel.load(Ordering::Relaxed) {
                    let Ok(resp) = client.get(format!("{BASE}/__down?bytes=25000000")).send().await else { break };
                    let mut body = resp.bytes_stream();
                    while let Some(Ok(chunk)) = body.next().await {
                        bytes.fetch_add(chunk.len() as u64, Ordering::Relaxed);
                        if Instant::now() >= deadline || cancel.load(Ordering::Relaxed) { break; }
                    }
                }
            }
        }, DOWNLOAD_STREAMS).await;
        if cancelled() { return cancelled_result(app); }
        download = Some(d);
    }

    // --- 4. Subida ---
    let mut upload = None;
    if opt.upload {
        // Bloque de datos pseudoaleatorios (no comprimibles) que se reenvía en trozos.
        let chunk = bytes::Bytes::from(random_bytes(256 * 1024));
        let u = measure(app, &cancel, "upload", seconds, |bytes, deadline| {
            let client = client.clone();
            let cancel = cancel.clone();
            let chunk = chunk.clone();
            async move {
                const CHUNKS_PER_REQUEST: usize = 32; // 8 MB por petición
                while Instant::now() < deadline && !cancel.load(Ordering::Relaxed) {
                    let counter = bytes.clone();
                    let c = chunk.clone();
                    let body = stream::iter(0..CHUNKS_PER_REQUEST).map(move |_| {
                        counter.fetch_add(c.len() as u64, Ordering::Relaxed);
                        Ok::<_, std::io::Error>(c.clone())
                    });
                    let req = client
                        .post(format!("{BASE}/__up"))
                        .header("Content-Type", "application/octet-stream")
                        .body(reqwest::Body::wrap_stream(body));
                    // Si se acaba el tiempo a mitad de una petición, la abandonamos.
                    let remaining = deadline.saturating_duration_since(Instant::now());
                    if tokio_timeout(remaining, req.send()).await.is_none() { break; }
                }
            }
        }, UPLOAD_STREAMS).await;
        if cancelled() { return cancelled_result(app); }
        upload = Some(u);
    }

    app(json!({
        "phase": "done",
        "ping": ping,
        "jitter": jitter,
        "download": download,
        "upload": upload,
        "isp": meta["asOrganization"],
        "server": meta["colo"]["city"].as_str().or(meta["colo"].as_str()),
    }));
    Ok(())
}

/// Lanza `streams` trabajadores en paralelo durante `seconds` y va informando de la
/// velocidad. Devuelve los Mb/s medios sin contar el arranque.
async fn measure<F, Fut>(
    app: Emit<'_>,
    cancel: &Arc<AtomicBool>,
    phase: &str,
    seconds: u64,
    worker: F,
    streams: usize,
) -> f64
where
    F: Fn(Arc<AtomicU64>, Instant) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    let bytes = Arc::new(AtomicU64::new(0));
    let start = Instant::now();
    let deadline = start + Duration::from_secs(seconds);
    let workers = join_all((0..streams).map(|_| worker(bytes.clone(), deadline)));

    let reporter = async {
        let tick = Duration::from_millis(200);
        let mut last = 0u64;
        let mut smooth = 0.0f64;
        let mut warm_bytes = None;
        loop {
            sleep(tick).await;
            let now = bytes.load(Ordering::Relaxed);
            let elapsed = start.elapsed();
            let instant_mbps = (now - last) as f64 * 8.0 / tick.as_secs_f64() / 1e6;
            smooth = if smooth == 0.0 { instant_mbps } else { smooth * 0.7 + instant_mbps * 0.3 };
            last = now;
            if warm_bytes.is_none() && elapsed >= WARMUP {
                warm_bytes = Some((now, elapsed));
            }
            app(json!({
                "phase": phase,
                "mbps": smooth,
                "progress": (elapsed.as_secs_f64() / seconds as f64).min(1.0),
            }));
            if elapsed >= Duration::from_secs(seconds) || cancel.load(Ordering::Relaxed) {
                let (b0, t0) = warm_bytes.unwrap_or((0, Duration::ZERO));
                let secs = (elapsed - t0).as_secs_f64().max(0.1);
                return (now - b0) as f64 * 8.0 / secs / 1e6;
            }
        }
    };

    let (_, mbps) = futures_util::future::join(workers, reporter).await;
    app(json!({ "phase": format!("{phase}-done"), "mbps": mbps }));
    mbps
}

fn cancelled_result(app: Emit<'_>) -> Result<(), String> {
    app(json!({ "phase": "cancelled" }));
    Ok(())
}

/// Suma de los tiempos de procesado del servidor (cabecera Server-Timing, en ms).
fn server_time_ms(headers: &reqwest::header::HeaderMap) -> f64 {
    headers
        .get_all("server-timing")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(','))
        .filter_map(|part| part.split(';').find_map(|kv| kv.trim().strip_prefix("dur=")))
        .filter_map(|d| d.parse::<f64>().ok())
        .sum()
}

fn median(v: &[f64]) -> f64 {
    if v.is_empty() { return 0.0; }
    let mut s = v.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let m = s.len() / 2;
    if s.len() % 2 == 0 { (s[m - 1] + s[m]) / 2.0 } else { s[m] }
}

fn random_bytes(n: usize) -> Vec<u8> {
    let mut x: u64 = 0x9E37_79B9_7F4A_7C15;
    (0..n)
        .map(|_| {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            x as u8
        })
        .collect()
}

async fn sleep(d: Duration) {
    tokio::time::sleep(d).await;
}

async fn tokio_timeout<F: std::future::Future>(d: Duration, f: F) -> Option<F::Output> {
    tokio::time::timeout(d, f).await.ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Prueba real contra Cloudflare (usa la red): cargo test speedtest -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn real_speedtest() {
        let emit = |v: Value| {
            let phase = v["phase"].as_str().unwrap_or("");
            if phase.ends_with("done") || phase == "meta" || phase == "error" {
                println!("{v}");
            }
        };
        let opt = Options { download: true, upload: true, seconds: 6 };
        run(&emit, Arc::new(AtomicBool::new(false)), opt).await.unwrap();
    }
}
