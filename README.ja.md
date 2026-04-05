# Zenliro

![Downloads](https://img.shields.io/github/downloads/LeHoangTuanbk/zenliro/total)
![GitHub Stars](https://img.shields.io/github/stars/LeHoangTuanbk/zenliro)

> **Enhance, not alter.** Lightroom Classicにインスパイアされた、AIエージェント搭載の写真現像アプリ。

Zenliroは、ムード、トーン、オーセンティシティを大切にするフォトグラファーのためのデスクトップ写真処理・カラーグレーディングツールです。破壊的な編集ではありません — オブジェクト除去もインペインティングもなし。光、色、そして雰囲気だけ。

---

## デモ

- メインワークスペース: ![main workspace](docs/releases/assets/main-workspace.png)
- 比較モード: ![compare mode](docs/releases/assets/compare-mode.png)
- AI一括編集: ![AI bulk edit](docs/releases/assets/bulk-edit-2.png)

---

## ウェブサイト

[zenliro](https://zenliro.vercel.app/)

---

## 機能

- **写真処理** — Raw、JPG、PNG、WebP、BMP、GIF、TIFFフォーマットをインポート。EXIFメタデータとヒストグラムを一目で確認。
- **現像モジュール** — Lightroom Classicと同等のパネル：Basic、Tone Curve、HSL、Color Grading、Detailなど。
- **キーボードショートカット** — 効率的なワークフローのための直感的なショートカット。
- **フォトライブラリ** — ドラッグ＆ドロップ対応のフォルダ管理で写真を直感的に管理。
- **AIエージェント** — エージェントが写真を分析し、調整を計画し、リアルタイムで編集。まるでフォトグラファーが操作しているかのように作業を見守れます。参照画像のスタイルをコピーしたり、自律的に最高の仕上がりを作り出すことができます。
- **AIによる一括編集** — 複数の写真をAIエージェントに割り当てて処理。エージェントが自動的に編集し、完了時に通知します。
- **非破壊編集** — 完全なundo/redo履歴。元のファイルは一切変更されません。
- **スタイルプリセット** — さまざまなムードやジャンルに対応する20以上の厳選されたルック。
- **WebGLレンダリング** — GPU上で完全にリアルタイムのカラー処理を行うカスタムシェーダー。

---

## 技術スタック

```
Electron
├── React + Vite + TypeScript      → UI（Feature-Sliced Designアーキテクチャ）
├── Shadcn/ui + Tailwind CSS       → コンポーネントシステム
├── WebGL（カスタムシェーダー）      → リアルタイムGPUカラー処理
├── Zustand                        → 状態管理
└── MCPサーバー                     → インテリジェントな写真編集のためのAIエージェント
```

---

## はじめに

```bash
pnpm install
pnpm dev
```

### ビルド

現在macOSのみサポート

```bash
pnpm dist:mac    # macOS DMG (arm64)
```

### GitHub Releasesからのインストール (.dmg)

#### ステップ1: [Releases](https://github.com/LeHoangTuanbk/zenliro/releases)ページから`.dmg`をダウンロードし、通常通りインストール。

#### ステップ2: コード署名とnotarizationのないオープンソースアプリのため、初回起動時にmacOSがブロックする場合があります：

![Apple can not check it for malicious software](docs/releases/assets/apple-can-not-check-software.png)

これを解決するには、ターミナルを開いて以下を実行：

```bash
xattr -cr /Applications/Zenliro.app
```

#### ステップ3: Zenliroを再度起動。

### AI写真編集

AI写真編集機能を使用するには、Claude CodeまたはCodex CLI、あるいはその両方をダウンロードしてインストールする必要があります：

- **Claude Code**: https://code.claude.com/docs/en/overview
- **Codex CLI**: https://developers.openai.com/codex/cli

---

## TODO

- [ ] バグ修正
- [ ] より良い写真管理機能と便利なショートカットの追加
- [ ] 画像処理パフォーマンスの最適化
- [ ] エージェントによる写真編集の改善
- [ ] マルチ解像度パイプラインのサポート
- [x] RAW写真フォーマットのサポート

---

## コントリビュート方法

1. issueを開いて、やりたいことを議論する。
2. アプローチと実装戦略について合意したら、リポジトリをforkする。
3. 変更を含むPRを提出する。
4. 必要に応じてドキュメントを更新し、テストケースを追加する。

---

## インスピレーション

- [Lightroom Classic](https://www.adobe.com/products/photoshop-lightroom-classic.html)
- [RapidRAW](https://github.com/CyberTimon/RapidRAW)
- [Pencil](https://www.pencil.com)

---

## ライセンス

[AGPL-3.0](./LICENSE)の下でライセンスされています。

Zenliroの修正版を配布またはデプロイする場合 — ホストされたサービスとしてを含む — 同じライセンスの下でソースコードを公開し、元のプロジェクトをクレジットする必要があります。
