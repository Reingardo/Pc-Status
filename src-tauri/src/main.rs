// Evita que se abra una consola junto a la app en release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pc_status_lib::run()
}
