use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const GITHUB_REPO: &str = "CmcnPro/MarkdownReader";

#[derive(Debug, Serialize, Clone)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub font_size: u32,
    pub line_width: u32,
    pub font_family: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "light".into(),
            language: "zh-CN".into(),
            font_size: 16,
            line_width: 780,
            font_family: "system".into(),
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

#[tauri::command]
fn list_system_fonts() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();

    let mut fonts = db
        .faces()
        .flat_map(|face| face.families.iter().map(|(name, _)| name.clone()))
        .collect::<Vec<_>>();

    fonts.sort();
    fonts.dedup();
    fonts
}

#[tauri::command]
fn get_config_dir() -> String {
    config_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn open_config_dir() -> Result<(), String> {
    let dir = config_dir();
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(dir)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(dir)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Unsupported platform".into())
    }
}

#[tauri::command]
fn get_platform() -> &'static str {
    #[cfg(target_os = "macos")]
    { "macos" }
    #[cfg(target_os = "windows")]
    { "windows" }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    { "other" }
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    let url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        GITHUB_REPO
    );

    let client = reqwest::Client::builder()
        .user_agent("MarkdownReader")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API returned status {}", resp.status()));
    }

    let release: GitHubRelease = resp.json().await.map_err(|e| e.to_string())?;

    let latest = release.tag_name.trim_start_matches('v');
    let has_update = latest != current_version;

    Ok(UpdateInfo {
        has_update,
        current_version,
        latest_version: latest.to_string(),
        release_url: release.html_url,
    })
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
            list_system_fonts,
            get_config_dir,
            open_config_dir,
            check_update,
            get_platform,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Markdown Reader");
}
