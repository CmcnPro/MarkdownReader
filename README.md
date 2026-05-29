# Markdown Reader

[![Build and Release](https://github.com/CmcnPro/MarkdownReader/actions/workflows/build.yml/badge.svg)](https://github.com/CmcnPro/MarkdownReader/actions/workflows/build.yml)

[中文](./README.zh-CN.md)

A lightweight, portable Markdown reader built with Rust and Tauri 2. Designed for sharing `.md` files with others — just drag, drop, and read.


> **This is a 100% vibe-coded project.** The entire codebase — frontend, backend, documentation, and build configuration — was generated through AI-assisted coding (Claude Code) with zero manual code editing. No human-written code exists in this repository.

## Features

- Drag and drop `.md` files to open
- Open files via dialog or `Ctrl+O`
- Full Markdown rendering: headings, lists, tables, blockquotes, images, links
- Code syntax highlighting (highlight.js)
- LaTeX math formula support (KaTeX)
- Light and dark themes
- Adjustable font size
- System font switching
- Recent files history
- Check for updates from GitHub Releases
- Open the config folder from About
- Portable — no installation required, config stored in user directory
- Native window chrome: macOS uses system traffic lights, Windows uses custom titlebar buttons

## Screenshot

![Overview](docs/screenshots/01-overview.png)
![Math](docs/screenshots/02-math.png)
![Quote and code](docs/screenshots/03-quote-code.png)

## Installation

### Download

Go to [Releases](https://github.com/CmcnPro/MarkdownReader/releases) and download the latest package:
- **Windows**: `.exe` installer or portable package
- **macOS**: `.dmg` or `.app` bundle

### Build from Source

**Prerequisites:**

- [Rust](https://www.rust-lang.org/tools/install) 1.70+
- [Node.js](https://nodejs.org/) 18+

```bash
# Clone the repository
git clone https://github.com/CmcnPro/MarkdownReader.git
cd MarkdownReader

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri 2 |
| Backend | Rust |
| Frontend | Vite + TypeScript |
| Markdown | markdown-it |
| Code Highlight | highlight.js |
| Math | KaTeX + markdown-it-texmath |
| Storage | User-directory JSON config |

## Project Structure

```
MarkdownReader/
├── src/                    # Frontend source
│   ├── index.html          # Main page
│   ├── main.ts             # App logic
│   └── styles.css          # Styles
├── src-tauri/              # Rust backend
│   └── src/
│       ├── main.rs         # Entry point
│       └── lib.rs          # Business logic
├── vite.config.ts          # Vite config
└── package.json            # Dependencies
```

## Documentation

- [AGENTS.md](./AGENTS.md) — AI Agent development guide

## License

[MIT](./LICENSE)
