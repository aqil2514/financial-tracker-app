mod attachments;
mod import;
mod migrations;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Debug build (`tauri dev` / `tauri build --debug`) pakai file
    // database terpisah dari release build, supaya development tidak
    // pernah menyentuh data production secara tidak sengaja. Harus
    // sinkron dengan DB_FILE di src/lib/db.ts (frontend).
    let db_url = if cfg!(debug_assertions) {
        "sqlite:finance.dev.db"
    } else {
        "sqlite:finance.db"
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db_url, migrations::get())
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            import::money_manager::command::import_money_manager,
            attachments::save_attachment_bytes,
            attachments::save_attachment_from_path,
            attachments::read_attachment_bytes,
            attachments::delete_attachment_file,
            attachments::get_default_attachment_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
