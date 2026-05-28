# AGENTS.md — AI Agent 开发指南

本文件帮助 AI Agent 快速理解项目结构、开发约定和常见操作。

## 项目概述

**Markdown Reader** 是一个基于 Rust + Tauri 2 的轻量级 Markdown 桌面阅读器。

- 目标：便携、绿色、免安装，适合分享 `.md` 文件
- 平台：Windows（可扩展至 macOS / Linux）
- 前端：Vite + TypeScript + 原生 DOM
- 后端：Rust + Tauri 2

## 项目结构

```
MarkdownReader/
├── package.json              # 前端依赖与脚本
├── vite.config.ts            # Vite 构建配置，root 设为 src/
├── tsconfig.json             # TypeScript 配置
├── src/                      # 前端源码（Vite root）
│   ├── index.html            # 主页面：工具栏 + 阅读区 + 拖拽层
│   ├── main.ts               # 应用逻辑入口
│   ├── styles.css            # 全局样式（亮/暗双主题）
│   └── vite-env.d.ts         # 类型声明
├── src-tauri/                # Rust 后端
│   ├── Cargo.toml            # Rust 依赖
│   ├── tauri.conf.json       # Tauri 应用配置
│   ├── build.rs              # Tauri 构建脚本
│   ├── capabilities/
│   │   └── default.json      # Tauri 权限声明
│   ├── icons/
│   │   └── icon.png          # 应用图标源文件
│   └── src/
│       ├── main.rs           # 程序入口，调用 lib::run()
│       └── lib.rs            # Tauri commands 与业务逻辑
└── AGENTS.md                 # 本文件
```

## 核心架构

### 前端 → 后端通信

前端通过 `@tauri-apps/api/core` 的 `invoke()` 调用 Rust 命令：

```typescript
import { invoke } from "@tauri-apps/api/core";
const content = await invoke<string>("read_markdown_file", { path });
```

Rust 端通过 `#[tauri::command]` 注册命令，在 `lib.rs` 的 `run()` 中通过 `invoke_handler` 注册。

### 已注册的 Tauri Commands

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `read_markdown_file` | `path: String` | `Result<String, String>` | 读取文件内容 |
| `get_file_name` | `path: String` | `String` | 提取文件名 |
| `get_parent_dir` | `path: String` | `String` | 提取父目录路径 |
| `resolve_asset_path` | `base_dir, relative` | `Result<String, String>` | 解析相对资源路径 |
| `get_settings` | 无 | `AppSettings` | 读取用户设置 |
| `save_settings` | `settings: AppSettings` | `Result<(), String>` | 保存用户设置 |
| `get_recent_files` | 无 | `Vec<RecentFile>` | 获取最近文件列表 |
| `add_recent_file` | `path: String` | `Result<Vec<RecentFile>, String>` | 添加到最近文件 |
| `clear_recent_files` | 无 | `Result<(), String>` | 清空最近文件 |
| `file_exists` | `path: String` | `bool` | 检查文件是否存在 |

### 数据存储

- 配置目录：`%AppData%/MarkdownReader/`（通过 `dirs::config_dir()` 获取）
- 配置文件：`config.json`，包含 `settings` 和 `recent_files`
- 前端不直接读写文件，所有持久化通过 Rust commands 完成

### Markdown 渲染管线

```
.md 文件 → Rust 读取 → 前端 invoke 获取内容
  → markdown-it 解析（含 texmath 数学公式插件）
  → highlight.js 代码高亮
  → KaTeX 数学公式渲染
  → innerHTML 注入 #markdown-body
```

### 主题系统

- 通过 `data-theme="light|dark"` 属性切换
- CSS 变量定义在 `styles.css` 的 `:root` 和 `[data-theme="dark"]` 中
- highlight.js 暗色覆盖写在 `styles.css` 底部

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式（启动 Vite + Tauri 窗口）
npm run tauri dev

# 构建前端
npm run build

# 构建发布包
npm run tauri build

# TypeScript 类型检查
npx tsc --noEmit

# Rust 编译检查
cd src-tauri && cargo check
```

## 开发约定

### TypeScript

- 使用 `invoke()` 的泛型版本指定返回类型：`invoke<string>("cmd", args)`
- 不使用 `window.__TAURI__` 全局对象，统一用 `@tauri-apps/api` 包导入
- 类型声明放在 `vite-env.d.ts`

### Rust

- 所有 Tauri command 函数必须是 `#[tauri::command]`
- 返回 `Result<T, String>` 用于前端错误处理
- 序列化结构体使用 `serde::Serialize + Deserialize`
- `main.rs` 只负责调用 `lib::run()`，逻辑放 `lib.rs`

### CSS

- 所有颜色通过 CSS 变量定义，不要硬编码颜色值
- 新增组件同时适配亮色和暗色主题
- 使用 `var(--radius)` / `var(--radius-sm)` 保持圆角一致

### 文件命名

- 前端：`kebab-case`
- Rust：`snake_case`

## 常见任务

### 添加新的 Tauri Command

1. 在 `src-tauri/src/lib.rs` 中编写 `#[tauri::command]` 函数
2. 在 `run()` 函数的 `invoke_handler` 中注册
3. 在 `src/main.ts` 中通过 `invoke("command_name", { args })` 调用

### 添加新的 UI 组件

1. 在 `src/index.html` 中添加 HTML 结构
2. 在 `src/styles.css` 中添加样式（同时适配亮/暗主题）
3. 在 `src/main.ts` 中绑定事件和逻辑

### 更新依赖

```bash
# 前端
npm update

# Rust
cd src-tauri && cargo update
```

## 注意事项

- `vite.config.ts` 的 `root` 设为 `"src"`，`index.html` 在 `src/` 目录下
- 构建输出到 `dist/`，Tauri 的 `frontendDist` 指向 `../dist`
- 拖拽功能依赖 Tauri 的 `onDragDropEvent`，需要 `dragDropEnabled: true`
- 数学公式使用 `markdown-it-texmath` + `KaTeX`，分隔符为 `$...$` 和 `$$...$$`
