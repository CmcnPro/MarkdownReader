# Markdown Reader

一个基于 Rust + Tauri 2 的轻量级 Markdown 桌面阅读器，专为分享 `.md` 文件设计。

## 特性

- 拖拽 `.md` 文件到窗口直接打开
- 点击「打开」按钮选择文件
- Markdown 渲染：标题、列表、表格、代码高亮、链接、图片
- LaTeX 数学公式支持（KaTeX）
- 亮色 / 暗色主题切换
- 字号调整
- 最近文件列表
- 用户目录存储配置
- Ctrl+O 快捷键打开文件
- 便携免安装

## 开发环境

- [Rust](https://www.rust-lang.org/) 1.70+
- [Node.js](https://nodejs.org/) 18+
- [Tauri 2 CLI](https://tauri.app/)

## 快速开始

```bash
# 安装前端依赖
npm install

# 启动开发模式
npm run tauri dev

# 构建发布包
npm run tauri build
```

## 项目结构

```
MarkdownReader/
├── src/                    # 前端源码
│   ├── index.html          # 主页面
│   ├── main.ts             # 应用逻辑
│   └── styles.css          # 样式
├── src-tauri/              # Rust 后端
│   └── src/
│       ├── main.rs         # 入口
│       └── lib.rs          # 业务逻辑
├── vite.config.ts          # Vite 配置
└── package.json            # 依赖
```

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Tauri 2 |
| 后端 | Rust |
| 前端 | Vite + TypeScript |
| Markdown | markdown-it |
| 代码高亮 | highlight.js |
| 数学公式 | KaTeX + markdown-it-texmath |
| 存储 | 用户目录 JSON 配置 |

## 文档

- [AGENTS.md](./AGENTS.md) — AI Agent 开发指南

## 许可证

MIT
