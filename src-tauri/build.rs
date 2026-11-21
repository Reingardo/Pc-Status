fn main() {
    // En release la app pide permisos de administrador (UAC) para que
    // LibreHardwareMonitor pueda leer temperaturas, ventiladores y voltajes.
    // En desarrollo no: abre la terminal como administrador si quieres todos los sensores.
    let mut attrs = tauri_build::Attributes::new();
    if std::env::var("PROFILE").as_deref() == Ok("release") {
        attrs = attrs.windows_attributes(
            tauri_build::WindowsAttributes::new().app_manifest(include_str!("app.manifest")),
        );
    }
    tauri_build::try_build(attrs).expect("tauri build failed");
}
