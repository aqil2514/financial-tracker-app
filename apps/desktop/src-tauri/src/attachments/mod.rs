use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;
use uuid::Uuid;

/// Folder default lampiran transaksi di app data dir — dipakai kalau user
/// belum memilih folder kustom lewat pengaturan (tabel `settings`,
/// key `attachment_folder`, dicek/dilewatkan dari sisi frontend).
fn default_attachment_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Gagal menemukan app data dir: {e}"))?;
    Ok(dir.join("attachments"))
}

fn ensure_dir(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("Gagal membuat folder lampiran: {e}"))
}

/// Dipakai frontend untuk menampilkan lokasi folder default di UI
/// pengaturan, supaya user tahu ke mana file tersimpan kalau belum
/// memilih folder kustom.
#[tauri::command]
pub fn get_default_attachment_dir(app: tauri::AppHandle) -> Result<String, String> {
    default_attachment_dir(&app)?
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Path folder default mengandung karakter tidak valid".to_string())
}

/// Nama file unik supaya foto dengan nama sama dari sumber berbeda
/// (mis. dua kali paste screenshot bernama sama) tidak saling menimpa.
fn unique_file_name(original_name: &str) -> String {
    let extension = Path::new(original_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("bin");
    format!("{}.{}", Uuid::new_v4(), extension)
}

/// Menyimpan bytes (dipakai untuk paste clipboard, yang tidak punya path
/// file sumber) ke folder tujuan. `target_dir` kosong berarti pakai
/// folder default di app data dir.
#[tauri::command]
pub fn save_attachment_bytes(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    original_name: String,
    target_dir: Option<String>,
) -> Result<String, String> {
    let dir = match target_dir.filter(|value| !value.trim().is_empty()) {
        Some(custom) => PathBuf::from(custom),
        None => default_attachment_dir(&app)?,
    };
    ensure_dir(&dir)?;

    let file_name = unique_file_name(&original_name);
    let destination = dir.join(&file_name);
    fs::write(&destination, bytes).map_err(|e| format!("Gagal menyimpan file lampiran: {e}"))?;

    destination
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Path lampiran mengandung karakter tidak valid".to_string())
}

/// Menyalin file dari path sumber (dipakai untuk dialog pilih file dan
/// drag & drop, yang keduanya memberi path native ke file asli).
#[tauri::command]
pub fn save_attachment_from_path(
    app: tauri::AppHandle,
    source_path: String,
    target_dir: Option<String>,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("File sumber tidak ditemukan: {source_path}"));
    }

    let dir = match target_dir.filter(|value| !value.trim().is_empty()) {
        Some(custom) => PathBuf::from(custom),
        None => default_attachment_dir(&app)?,
    };
    ensure_dir(&dir)?;

    let original_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("attachment");
    let file_name = unique_file_name(original_name);
    let destination = dir.join(&file_name);
    fs::copy(&source, &destination).map_err(|e| format!("Gagal menyalin file lampiran: {e}"))?;

    destination
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Path lampiran mengandung karakter tidak valid".to_string())
}

/// Membaca isi file lampiran sebagai bytes — dipakai frontend untuk
/// menampilkan preview (dikonversi ke data URL), karena WebView tidak
/// bisa mengakses filesystem lokal secara langsung.
#[tauri::command]
pub fn read_attachment_bytes(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path).map_err(|e| format!("Gagal membaca file lampiran: {e}"))
}

/// Menghapus file fisik lampiran. Dipanggil terpisah dari penghapusan
/// baris `transaction_attachments` (yang terjadi lewat SQL, termasuk
/// otomatis via ON DELETE CASCADE saat transaksi induk dihapus) karena
/// CASCADE hanya membersihkan baris database, bukan file di disk.
#[tauri::command]
pub fn delete_attachment_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(&path).map_err(|e| format!("Gagal menghapus file lampiran: {e}"))
}
