import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import texmath from "markdown-it-texmath";
import katex from "katex";
import "katex/dist/katex.min.css";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";

// ── Markdown-it setup ──
const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        // fall through
      }
    }
    return md.utils.escapeHtml(str);
  },
});

md.use(texmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: { throwOnError: false },
});

// ── DOM refs ──
const $ = (id: string) => document.getElementById(id)!;

const elFileName = $("file-name");
const elEmpty = $("empty-state");
const elError = $("error-state");
const elErrorMsg = $("error-message");
const elBody = $("markdown-body");
const elDropOverlay = $("drop-overlay");
const elRecentPanel = $("recent-panel");
const elRecentList = $("recent-list");
const elMenuPanel = $("menu-panel");
const elMenuFontSelect = $("menu-font-select") as HTMLSelectElement;
const elFontSizeDisplay = $("font-size-display");
const elIconSun = $("icon-sun");
const elIconMoon = $("icon-moon");
const elAboutModal = $("about-modal");
const elAboutVersion = $("about-version");
const elAboutUpdateResult = $("about-update-result");
const elIconNarrow = $("icon-narrow");
const elIconWide = $("icon-wide");
const elBtnMaximize = $("btn-maximize") as HTMLButtonElement;
const elIconMaximize = $("icon-maximize");
const elIconRestore = $("icon-restore");

// ── State ──
const DEFAULT_FONT_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", Helvetica, Arial, sans-serif';

let fontSize = 16;
let fontFamily = "system";
let systemFonts: string[] = [];
let widthMode: "narrow" | "wide" = "narrow";
let theme: "light" | "dark" = "light";
let language: "zh-CN" | "en-US" = "zh-CN";

type LangKey = "zh-CN" | "en-US";

const I18N: Record<LangKey, Record<string, string>> = {
  "zh-CN": {
    appTitle: "Markdown Reader",
    open: "打开",
    openFile: "打开文件",
    recent: "最近文件",
    clear: "清空",
    font: "切换字体",
    smaller: "缩小字号",
    bigger: "放大字号",
    width: "切换宽窄屏",
    about: "关于",
    theme: "切换主题",
    language: "中/EN",
    minimize: "最小化",
    maximize: "最大化",
    restore: "还原",
    close: "关闭",
    openMarkdown: "打开一个 Markdown 文件",
    hint: "拖放 .md 文件到这里，或点击上方「打开」按钮",
    retry: "重新打开",
    checkUpdate: "检查更新",
    checking: "检查中...",
    noRecent: "暂无最近文件",
    selectedFont: "系统字体",
    latestVersion: "已是最新版本",
    checkFailed: "检查失败",
    openingFile: "打开 Markdown 文件",
    allFiles: "所有文件",
    configFolder: "配置文件夹",
    aboutTitle: "关于 Markdown Reader",
    dropHint: "释放文件以打开",
    loadFailed: "加载失败",
    download: "前往下载",
    newVersionFound: "发现新版本",
    openConfig: "打开配置文件夹",
    settingsLanguage: "zh-CN",
    menu: "菜单",
    menuFont: "字体",
    menuTheme: "主题",
    menuLanguage: "语言",
    menuAbout: "关于",
    themeLight: "浅色",
    themeDark: "深色",
    langChinese: "中文",
    langEnglish: "English",
  },
  "en-US": {
    appTitle: "Markdown Reader",
    open: "Open",
    openFile: "Open file",
    recent: "Recent",
    clear: "Clear",
    font: "Font",
    smaller: "Smaller",
    bigger: "Bigger",
    width: "Width",
    about: "About",
    theme: "Theme",
    language: "中/EN",
    minimize: "Minimize",
    maximize: "Maximize",
    restore: "Restore",
    close: "Close",
    openMarkdown: "Open a Markdown file",
    hint: "Drop a .md file here or click Open",
    retry: "Reopen",
    loading: "Checking...",
    checkUpdate: "Check updates",
    checking: "Checking...",
    noRecent: "No recent files",
    selectedFont: "System font",
    latestVersion: "You are on the latest version",
    checkFailed: "Check failed",
    openingFile: "Open Markdown file",
    allFiles: "All files",
    openConfig: "Open config folder",
    settingsLanguage: "en-US",
    menu: "Menu",
    menuFont: "Font",
    menuTheme: "Theme",
    menuLanguage: "Language",
    menuAbout: "About",
    themeLight: "Light",
    themeDark: "Dark",
    langChinese: "中文",
    langEnglish: "English",
  },
};

function t(key: string) {
  return I18N[language][key] ?? key;
}

// ── Helpers ──
function showView(view: "empty" | "error" | "content") {
  elEmpty.classList.toggle("hidden", view !== "empty");
  elError.classList.toggle("hidden", view !== "error");
  elBody.classList.toggle("hidden", view !== "content");
}

function applyLanguage() {
  const dict = I18N[language];
  document.querySelector(".app-title")!.textContent = dict.appTitle;
  $("btn-open").querySelector("span")!.textContent = dict.open;
  $("btn-open").title = dict.openFile;
  $("btn-recent").title = dict.recent;
  $("recent-title")!.textContent = dict.recent;
  $("btn-clear-recent").title = dict.clear;
  $("btn-font-minus").title = dict.smaller;
  $("btn-font-plus").title = dict.bigger;
  $("btn-width").title = dict.width;
  $("btn-menu").title = dict.menu;
  $("btn-minimize").title = dict.minimize;
  $("btn-maximize").title = dict.maximize;
  $("btn-close").title = dict.close;
  $("btn-retry").textContent = dict.retry;
  elEmpty.querySelector(".empty-title")!.textContent = dict.openMarkdown;
  elEmpty.querySelector(".empty-hint")!.textContent = dict.hint;
  $("btn-check-update").textContent = dict.checkUpdate;
  $("btn-about-close").title = dict.close;
  $("open-config-label")!.textContent = dict.openConfig;
  elErrorMsg.textContent = language === "zh-CN" ? dict.loadFailed : "Load failed";
  $("about-title")!.textContent = dict.aboutTitle;
  $("drop-hint")!.textContent = dict.dropHint;

  // Menu panel
  $("menu-font-label")!.textContent = dict.menuFont;
  $("menu-theme-label")!.textContent = dict.menuTheme;
  $("menu-language-label")!.textContent = dict.menuLanguage;
  $("menu-about-label")!.textContent = dict.menuAbout;
  $("menu-theme-value")!.textContent = theme === "light" ? dict.themeLight : dict.themeDark;
  $("menu-language-value")!.textContent = language === "zh-CN" ? dict.langChinese : dict.langEnglish;
}


function normalizeFilePath(path: string) {
  if (path.startsWith("file://")) {
    return decodeURIComponent(new URL(path).pathname);
  }
  return path;
}

async function loadFile(path: string) {
  try {
    const filePath = normalizeFilePath(path);
    const content = await invoke<string>("read_markdown_file", { path: filePath });
    const fileName = await invoke<string>("get_file_name", { path: filePath });

    elFileName.textContent = fileName;
    document.title = `${fileName} — Markdown Reader`;

    elBody.innerHTML = md.render(content);
    showView("content");
    $("content-area").scrollTop = 0;

    await invoke("add_recent_file", { path });
  } catch (e) {
    elErrorMsg.textContent = String(e);
    showView("error");
  }
}

// ── Open file via dialog ──
async function openFile() {
  try {
    const selected = await openFileDialog({
      title: t("openingFile"),
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
        { name: t("allFiles"), extensions: ["*"] },
      ],
      multiple: false,
    });
    if (selected) {
      await loadFile(selected);
    }
  } catch {
    // user cancelled
  }
}

// ── About modal ──
function openAbout() {
  elAboutModal.classList.remove("hidden");
  elAboutUpdateResult.classList.add("hidden");
}

async function openConfigFolder() {
  await invoke("open_config_dir");
}

function closeAbout() {
  elAboutModal.classList.add("hidden");
}

async function checkUpdate() {
  const btn = $("btn-check-update") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = t("checking");
  elAboutUpdateResult.classList.remove("hidden", "has-update", "no-update", "error");
  elAboutUpdateResult.textContent = "";

  try {
    const info = await invoke<{
      has_update: boolean;
      current_version: string;
      latest_version: string;
      release_url: string;
    }>("check_update");

    if (info.has_update) {
      elAboutUpdateResult.classList.add("has-update");
      elAboutUpdateResult.innerHTML =
        (language === "zh-CN"
          ? `${t("newVersionFound")} v${escapeHtml(info.latest_version)}！`
          : `${t("newVersionFound")} v${escapeHtml(info.latest_version)}!`) +
        `<br><a href="#" id="about-release-link">${t("download")}</a>`;
      $("about-release-link").addEventListener("click", (e) => {
        e.preventDefault();
        openUrl(info.release_url);
      });
    } else {
      elAboutUpdateResult.classList.add("no-update");
      elAboutUpdateResult.textContent = `v${info.current_version} ${t("latestVersion")}`;
    }
  } catch (e) {
    elAboutUpdateResult.classList.add("error");
    elAboutUpdateResult.textContent = `${t("checkFailed")}: ${String(e)}`;
  } finally {
    btn.disabled = false;
    btn.textContent = t("checkUpdate");
  }
}

// ── Drag & drop via Tauri native events ──
const appWindow = getCurrentWindow();
appWindow.onDragDropEvent((event) => {
  if (event.payload.type === "over") {
    elDropOverlay.classList.remove("hidden");
  } else if (event.payload.type === "drop") {
    elDropOverlay.classList.add("hidden");
    const paths = event.payload.paths;
    if (paths && paths.length > 0) {
      loadFile(normalizeFilePath(paths[0]));
    }
  } else if (event.payload.type === "leave") {
    elDropOverlay.classList.add("hidden");
  }
});

// ── Recent files ──
async function toggleRecentPanel() {
  elRecentPanel.classList.toggle("hidden");
  elMenuPanel.classList.add("hidden");
  if (!elRecentPanel.classList.contains("hidden")) {
    await renderRecentFiles();
  }
}

async function toggleMenuPanel() {
  elMenuPanel.classList.toggle("hidden");
  elRecentPanel.classList.add("hidden");
}

async function renderRecentFiles() {
  const files = await invoke<Array<{ path: string; name: string }>>(
    "get_recent_files"
  );

  if (files.length === 0) {
    elRecentList.innerHTML = `<li class="recent-empty">${t("noRecent")}</li>`;
    return;
  }

  elRecentList.innerHTML = files
    .map(
      (f) => `
    <li class="recent-item" data-path="${escapeHtml(f.path)}">
      ${escapeHtml(f.name)}
      <span class="recent-item-path">${escapeHtml(f.path)}</span>
    </li>
  `
    )
    .join("");
}

elRecentList.addEventListener("click", async (e) => {
  const item = (e.target as HTMLElement).closest(".recent-item") as HTMLElement;
  if (item) {
    const path = item.dataset.path;
    if (path) {
      elRecentPanel.classList.add("hidden");
      await loadFile(path);
    }
  }
});

async function clearRecentFiles() {
  await invoke("clear_recent_files");
  await renderRecentFiles();
}

// ── Theme ──
async function toggleTheme() {
  theme = theme === "light" ? "dark" : "light";
  applyTheme();
  applyLanguage(); // Update menu display
  const settings = await invoke<Record<string, unknown>>("get_settings");
  settings.theme = theme;
  await invoke("save_settings", { settings });
}

async function toggleLanguage() {
  language = language === "zh-CN" ? "en-US" : "zh-CN";
  applyLanguage();
  const settings = await invoke<Record<string, unknown>>("get_settings");
  settings.language = language;
  await invoke("save_settings", { settings });
}

function applyTheme() {
  document.body.dataset.theme = theme;
  elIconSun.style.display = theme === "light" ? "" : "none";
  elIconMoon.style.display = theme === "dark" ? "" : "none";
}

// ── Font size ──
async function changeFontSize(delta: number) {
  fontSize = Math.max(12, Math.min(24, fontSize + delta));
  applyFontSize();
  const settings = await invoke<Record<string, unknown>>("get_settings");
  settings.font_size = fontSize;
  await invoke("save_settings", { settings });
}

async function changeFontFamily(value: string) {
  fontFamily = value;
  applyFontFamily();
  const settings = await invoke<Record<string, unknown>>("get_settings");
  settings.font_family = fontFamily;
  await invoke("save_settings", { settings });
}

function applyFontSize() {
  document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
  elFontSizeDisplay.textContent = `${fontSize}px`;
}

function applyFontFamily() {
  const family =
    fontFamily === "system" ? DEFAULT_FONT_SANS : `"${fontFamily.replace(/"/g, '\\"')}", ${DEFAULT_FONT_SANS}`;
  document.documentElement.style.setProperty("--font-sans", family);
  document.body.style.fontFamily = family;
  elMenuFontSelect.value = fontFamily;
}

// ── Line width ──
async function toggleWidth() {
  widthMode = widthMode === "narrow" ? "wide" : "narrow";
  applyLineWidth();
  const settings = await invoke<Record<string, unknown>>("get_settings");
  settings.line_width = widthMode === "wide" ? 1100 : 780;
  await invoke("save_settings", { settings });
}

function applyLineWidth() {
  const isWide = widthMode === "wide";
  const windowWidth = window.innerWidth;
  const contentWidth = isWide
    ? Math.min(Math.max(windowWidth * 0.88, 960), 2400)
    : Math.min(Math.max(windowWidth * 0.66, 720), 1400);

  document.documentElement.style.setProperty("--content-width", `${Math.round(contentWidth)}px`);
  elIconNarrow.style.display = isWide ? "" : "none";
  elIconWide.style.display = isWide ? "none" : "";
}

async function syncWindowButtons() {
  const maximized = await appWindow.isMaximized();
  elIconMaximize.style.display = maximized ? "none" : "";
  elIconRestore.style.display = maximized ? "" : "none";
  elBtnMaximize.title = maximized ? t("restore") : t("maximize");
  elBtnMaximize.setAttribute("aria-label", maximized ? t("restore") : t("maximize"));
}

async function loadSystemFonts() {
  systemFonts = await invoke<string[]>("list_system_fonts");
  const options = ["system", ...systemFonts];
  elMenuFontSelect.innerHTML = options
    .map((font) => `<option value="${escapeHtml(font)}">${escapeHtml(font === "system" ? t("selectedFont") : font)}</option>`)
    .join("");

  if (fontFamily !== "system" && !systemFonts.includes(fontFamily)) {
    fontFamily = "system";
  }
  applyFontFamily();
}

// ── Escape HTML ──
function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Close recent panel on outside click ──
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (
    !elRecentPanel.classList.contains("hidden") &&
    !elRecentPanel.contains(target) &&
    !$("btn-recent").contains(target)
  ) {
    elRecentPanel.classList.add("hidden");
  }
  if (
    !elMenuPanel.classList.contains("hidden") &&
    !elMenuPanel.contains(target) &&
    !$("btn-menu").contains(target)
  ) {
    elMenuPanel.classList.add("hidden");
  }
});

// ── Close About modal on overlay click ──
elAboutModal.addEventListener("click", (e) => {
  if (e.target === elAboutModal) {
    closeAbout();
  }
});

// ── Keyboard shortcuts ──
document.addEventListener("keydown", async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "o") {
    e.preventDefault();
    await openFile();
  }
  if (e.key === "Escape") {
    elRecentPanel.classList.add("hidden");
    elMenuPanel.classList.add("hidden");
    closeAbout();
  }
});

// ── Button bindings ──
$("btn-open").addEventListener("click", openFile);
$("btn-recent").addEventListener("click", toggleRecentPanel);
$("btn-clear-recent").addEventListener("click", clearRecentFiles);
$("btn-menu").addEventListener("click", toggleMenuPanel);
$("btn-font-minus").addEventListener("click", () => changeFontSize(-1));
$("btn-font-plus").addEventListener("click", () => changeFontSize(1));
$("btn-retry").addEventListener("click", openFile);
$("btn-width").addEventListener("click", toggleWidth);
$("btn-minimize").addEventListener("click", () => appWindow.minimize());
$("btn-maximize").addEventListener("click", async () => {
  await appWindow.toggleMaximize();
  await syncWindowButtons();
});
$("btn-close").addEventListener("click", () => appWindow.close());
elMenuFontSelect.addEventListener("change", (e) => changeFontFamily((e.target as HTMLSelectElement).value));
$("menu-theme").addEventListener("click", toggleTheme);
$("menu-language").addEventListener("click", toggleLanguage);
$("menu-about").addEventListener("click", () => {
  elMenuPanel.classList.add("hidden");
  openAbout();
});
$("btn-about-close").addEventListener("click", closeAbout);
$("btn-check-update").addEventListener("click", checkUpdate);
$("btn-open-config").addEventListener("click", openConfigFolder);

// ── Init ──
const GITHUB_URL = "https://github.com/CmcnPro/MarkdownReader";

let platform: string = "windows";

async function detectPlatform() {
  try {
    platform = await invoke<string>("get_platform");
  } catch {
    // fallback to windows behavior
  }
  if (platform === "macos") {
    document.body.classList.add("platform-macos");
    const wc = document.querySelector(".window-controls") as HTMLElement | null;
    if (wc) wc.style.display = "none";
  }
}

async function init() {
  await detectPlatform();
  try {
    const settings = await invoke<{
      theme: string;
      language: string;
      font_size: number;
      line_width: number;
      font_family: string;
    }>("get_settings");
    theme = settings.theme === "dark" ? "dark" : "light";
    language = settings.language === "en-US" ? "en-US" : "zh-CN";
    fontSize = settings.font_size || 16;
    widthMode = (settings.line_width || 780) >= 960 ? "wide" : "narrow";
    fontFamily = settings.font_family || "system";
  } catch {
    // use defaults
  }

  // Set About version
  try {
    const version = await getVersion();
    elAboutVersion.textContent = `v${version}`;
  } catch {
    // keep default
  }

  // Set GitHub link
  $("about-github").addEventListener("click", (e) => {
    e.preventDefault();
    openUrl(GITHUB_URL);
  });

  await loadSystemFonts();
  elMenuFontSelect.value = fontFamily;

  applyTheme();
  applyLanguage();
  applyFontSize();
  applyFontFamily();
  applyLineWidth();
  await syncWindowButtons();
  window.addEventListener("resize", applyLineWidth);
  appWindow.onResized(syncWindowButtons);
  showView("empty");
}

init();
