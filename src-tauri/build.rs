fn main() {
    // La ventana de PC Status se ejecuta sin permisos de administrador (manifiesto por
    // defecto de Tauri). Solo el proceso de sensores se lanza elevado: ver src/sensors.rs.
    tauri_build::build()
}
