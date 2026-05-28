import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import texmath from "markdown-it-texmath";
import katex from "katex";
import "katex/dist/katex.min.css";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

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
const elFontSizeDisplay = $("font-size-display");
const elIconSun = $("icon-sun");
const elIconMoon = $("icon-moon");

// ── State ──
let fontSize = 16;
let lineWidth = 780;
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
  settings.fontSize = fontSize;
  await invoke("save_settings", { settings });
}

function applyFontSize() {
  document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
  elFontSizeDisplay.textContent = `${fontSize}px`;
}

// ── Line width ──
function applyLineWidth() {
  document.documentElement.style.setProperty("--line-width", `${lineWidth}px`);
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

// ── Keyboard shortcuts ──
document.addEventListener("keydown", async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "o") {
    e.preventDefault();
    await openFile();
  }
  if (e.key === "Escape") {
    elRecentPanel.classList.add("hidden");
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

// ── Init ──
async function init() {
  try {
    const settings = await invoke<{
      theme: string;
      font_size: number;
      line_width: number;
    }>("get_settings");
    theme = settings.theme === "dark" ? "dark" : "light";
    fontSize = settings.font_size || 16;
    lineWidth = settings.line_width || 780;
  } catch {
    // use defaults
  }

  applyTheme();
  applyFontSize();
  applyLineWidth();
  showView("empty");
}

init();
