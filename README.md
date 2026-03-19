# Zenliro

> **Enhance, not alter.** A Lightroom Classic-inspired photo development app powered by AI.

Zenliro is a desktop RAW processing and color grading tool built for photographers who care about mood, tone, and authenticity. Not a destructive editor — no object removal, no inpainting. Just light, color, and feel.

---

## Features

- **RAW Processing** — Import RAW, JPG, PNG, TIFF and more. View EXIF metadata and overall histogram at a glance.
- **Develop Module** — Full panel parity with Lightroom Classic: Basic, Tone Curve, HSL, Color Grading, Detail, and more.
- **AI Agent** — Claude-powered agent analyzes your photo, plans adjustments, and edits in real-time. Watch it work like a photographer at the controls. Can copy the style of a reference image or craft the best possible output autonomously.
- **Non-destructive** — Full undo/redo history. Original file is never touched.
- **Style Presets** — 10 curated looks for different moods and genres.
- **WebGL Rendering** — Custom-written shaders for real-time color processing entirely on the GPU.

---

## Tech Stack

```
Electron
├── React + Vite + TypeScript      → UI (Feature-Sliced Design architecture)
├── Shadcn/ui + Tailwind CSS       → Component system
├── WebGL (custom shaders)         → Real-time GPU color processing
├── Zustand                        → State management
└── Claude (MCP)                   → AI agent for intelligent photo editing
```

---

## Getting Started

```bash
pnpm install
pnpm dev
```

### Build

```bash
pnpm dist:mac    # macOS DMG (arm64)
pnpm dist:win    # Windows (x64)
pnpm dist:linux  # Linux AppImage (x64)
```

### Install unsigned build on macOS

macOS will block apps without a code signature. Run:

```bash
xattr -cr /Applications/Zenliro.app
```

Or: right-click the `.app` → **Open** → click **Open** in the dialog.

---

## Inspired By

- [Lightroom Classic](https://www.adobe.com/products/photoshop-lightroom-classic.html)
- [RapidRAW](https://github.com/CyberTimon/RapidRAW)
- [Pencil](https://www.pencil.com)

---

## License

Licensed under [AGPL-3.0](./LICENSE).

If you distribute or deploy a modified version of Zenliro — including as a hosted service — you must release the source code under the same license and credit the original project.
