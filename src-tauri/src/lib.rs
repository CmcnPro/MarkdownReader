use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub theme: String,
    pub font_size: u32,
    pub line_width: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "light".into(),
            font_size: 16,
            line_width: 780,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub opened_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppState {
    pub settings: AppSettings,
    pub recent_files: Vec<RecentFile>,
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("MarkdownReader")
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

fn load_state() -> AppState {
    let path = config_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        AppState::default()
    }
}

fn save_state(state: &AppState) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(config_path(), json).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("文件不存在".into());
    }
    if !p.is_file() {
        return Err("路径不是文件".into());
    }
    fs::read_to_string(p).map_err(|e| format!("读取文件失败: {}", e))
}

#[tauri::command]
fn get_file_name(path: String) -> String {
    Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("未命名")
        .to_string()
}

#[tauri::command]
fn get_parent_dir(path: String) -> String {
    Path::new(&path)
        .parent()
        .and_then(|p| p.to_str())
        .unwrap_or("")
        .to_string()
}

#[tauri::command]
fn resolve_asset_path(base_dir: String, relative: String) -> Result<String, String> {
    let base = Path::new(&base_dir);
    let resolved = base.join(&relative);
    let canonical = fs::canonicalize(&resolved).map_err(|e| e.to_string())?;
    canonical
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "路径无效".into())
}

#[tauri::command]
fn get_settings() -> AppSettings {
    load_state().settings
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let mut state = load_state();
    state.settings = settings;
    save_state(&state)
}

#[tauri::command]
fn get_recent_files() -> Vec<RecentFile> {
    load_state().recent_files
}

#[tauri::command]
fn add_recent_file(path: String) -> Result<Vec<RecentFile>, String> {
    let mut state = load_state();
    let name = Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("未命名")
        .to_string();

    state.recent_files.retain(|f| f.path != path);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    state.recent_files.insert(
        0,
        RecentFile {
            path,
            name,
            opened_at: now,
        },
    );

    if state.recent_files.len() > 20 {
        state.recent_files.truncate(20);
    }

    save_state(&state)?;
    Ok(state.recent_files)
}

#[tauri::command]
fn clear_recent_files() -> Result<(), String> {
    let mut state = load_state();
    state.recent_files.clear();
    save_state(&state)
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_markdown_file,
            get_file_name,
            get_parent_dir,
            resolve_asset_path,
            get_settings,
            save_settings,
            get_recent_files,
            add_recent_file,
            clear_recent_files,
            file_exists,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Markdown Reader");
}
