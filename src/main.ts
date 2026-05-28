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
const elFontFamilySelect = $("font-family-select") as HTMLSelectElement;
const elFontSizeDisplay = $("font-size-display");
const elIconSun = $("icon-sun");
const elIconMoon = $("icon-moon");
const elAboutModal = $("about-modal");
const elAboutVersion = $("about-version");
const elAboutUpdateResult = $("about-update-result");
const elIconNarrow = $("icon-narrow");
const elIconWide = $("icon-wide");

// ── State ──
const DEFAULT_FONT_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", Helvetica, Arial, sans-serif';

let fontSize = 16;
let fontFamily = "system";
let systemFonts: string[] = [];
let widthMode: "narrow" | "wide" = "narrow";
let theme: "light" | "dark" = "light";

// ── Helpers ──
function showView(view: "empty" | "error" | "content") {
  elEmpty.classList.toggle("hidden", view !== "empty");
  elError.classList.toggle("hidden", view !== "error");
  elBody.classList.toggle("hidden", view !== "content");
}

async function loadFile(path: string) {
  try {
    const content = await invoke<string>("read_markdown_file", { path });
    const fileName = await invoke<string>("get_file_name", { path });

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
      title: "打开 Markdown 文件",
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
        { name: "所有文件", extensions: ["*"] },
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
  btn.textContent = "检查中...";
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
        `发现新版本 v${escapeHtml(info.latest_version)}！` +
        `<br><a href="#" id="about-release-link">前往下载</a>`;
      $("about-release-link").addEventListener("click", (e) => {
        e.preventDefault();
        openUrl(info.release_url);
      });
    } else {
      elAboutUpdateResult.classList.add("no-update");
      elAboutUpdateResult.textContent = `已是最新版本 v${info.current_version}`;
    }
  } catch (e) {
    elAboutUpdateResult.classList.add("error");
    elAboutUpdateResult.textContent = `检查失败：${String(e)}`;
  } finally {
    btn.disabled = false;
    btn.textContent = "检查更新";
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
      loadFile(paths[0]);
    }
  } else if (event.payload.type === "leave") {
    elDropOverlay.classList.add("hidden");
  }
});

// ── Recent files ──
async function toggleRecentPanel() {
  elRecentPanel.classList.toggle("hidden");
  if (!elRecentPanel.classList.contains("hidden")) {
    await renderRecentFiles();
  }
}

async function renderRecentFiles() {
  const files = await invoke<Array<{ path: string; name: string }>>(
    "get_recent_files"
  );

  if (files.length === 0) {
    elRecentList.innerHTML = '<li class="recent-empty">暂无最近文件</li>';
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
  const settings = await invoke<Record<string, unknown>>("get_settings");
  settings.theme = theme;
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
  elFontFamilySelect.value = fontFamily;
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

async function loadSystemFonts() {
  systemFonts = await invoke<string[]>("list_system_fonts");
  const options = ["system", ...systemFonts];
  elFontFamilySelect.innerHTML = options
    .map((font) => `<option value="${escapeHtml(font)}">${escapeHtml(font === "system" ? "系统字体" : font)}</option>`)
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
    closeAbout();
  }
});

// ── Button bindings ──
$("btn-open").addEventListener("click", openFile);
$("btn-recent").addEventListener("click", toggleRecentPanel);
$("btn-clear-recent").addEventListener("click", clearRecentFiles);
$("btn-theme").addEventListener("click", toggleTheme);
$("btn-font-minus").addEventListener("click", () => changeFontSize(-1));
$("btn-font-plus").addEventListener("click", () => changeFontSize(1));
$("btn-retry").addEventListener("click", openFile);
$("btn-width").addEventListener("click", toggleWidth);
elFontFamilySelect.addEventListener("change", (e) => changeFontFamily((e.target as HTMLSelectElement).value));
$("btn-about").addEventListener("click", openAbout);
$("btn-about-close").addEventListener("click", closeAbout);
$("btn-check-update").addEventListener("click", checkUpdate);
$("btn-open-config").addEventListener("click", openConfigFolder);

// ── Init ──
const GITHUB_URL = "https://github.com/CmcnPro/MarkdownReader";

async function init() {
  try {
    const settings = await invoke<{
      theme: string;
      font_size: number;
      line_width: number;
      font_family: string;
    }>("get_settings");
    theme = settings.theme === "dark" ? "dark" : "light";
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
  elFontFamilySelect.value = fontFamily;

  applyTheme();
  applyFontSize();
  applyFontFamily();
  applyLineWidth();
  window.addEventListener("resize", applyLineWidth);
  showView("empty");
}

init();
