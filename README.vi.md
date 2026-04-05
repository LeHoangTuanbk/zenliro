# Zenliro

![Downloads](https://img.shields.io/github/downloads/LeHoangTuanbk/zenliro/total)
![GitHub Stars](https://img.shields.io/github/stars/LeHoangTuanbk/zenliro)

> **Enhance, not alter.** Ứng dụng xử lý ảnh lấy cảm hứng từ Lightroom Classic, được hỗ trợ bởi AI Agent.

Zenliro là công cụ xử lý ảnh và color grading trên desktop, dành cho các nhiếp ảnh gia quan tâm đến mood, tone và sự chân thực. Không phải trình chỉnh sửa phá hủy — không xóa vật thể, không inpainting. Chỉ có ánh sáng, màu sắc và cảm xúc.

---

## Demo

- Giao diện chính: ![main workspace](docs/releases/assets/main-workspace.png)
- Chế độ so sánh: ![compare mode](docs/releases/assets/compare-mode.png)
- Chỉnh sửa hàng loạt bằng AI: ![AI bulk edit](docs/releases/assets/bulk-edit-2.png)

---

## Website

[zenliro](https://zenliro.vercel.app/)

---

## Tính năng

- **Xử lý ảnh** — Import các định dạng Raw, JPG, PNG, WebP, BMP, GIF và TIFF. Xem metadata EXIF và histogram tổng quan.
- **Module Develop** — Đầy đủ các panel như Lightroom Classic: Basic, Tone Curve, HSL, Color Grading, Detail, và nhiều hơn nữa.
- **Phím tắt** — Phím tắt trực quan được thiết kế cho quy trình làm việc hiệu quả.
- **Thư viện ảnh** — Quản lý ảnh trực quan theo thư mục với hỗ trợ kéo thả.
- **AI Agent** — Agent phân tích ảnh, lên kế hoạch chỉnh sửa và thực hiện theo thời gian thực. Xem nó làm việc như một nhiếp ảnh gia đang ngồi chỉnh ảnh. Có thể sao chép phong cách từ ảnh tham chiếu hoặc tự động tạo ra kết quả tốt nhất.
- **Chỉnh sửa hàng loạt bằng AI** — Giao một loạt ảnh cho AI Agent xử lý. Agent sẽ tự động chỉnh sửa và thông báo khi hoàn thành.
- **Non-destructive** — Lịch sử undo/redo đầy đủ. File gốc không bao giờ bị thay đổi.
- **Preset phong cách** — 20+ preset được chọn lọc cho các mood và thể loại khác nhau.
- **Render bằng WebGL** — Shader tự viết cho xử lý màu sắc real-time hoàn toàn trên GPU.

---

## Tech Stack

```
Electron
├── React + Vite + TypeScript      → UI (Kiến trúc Feature-Sliced Design)
├── Shadcn/ui + Tailwind CSS       → Hệ thống component
├── WebGL (shader tự viết)         → Xử lý màu real-time trên GPU
├── Zustand                        → Quản lý state
└── MCP server                     → AI agent cho chỉnh sửa ảnh thông minh
```

---

## Bắt đầu

```bash
pnpm install
pnpm dev
```

### Build

Hiện tại chỉ hỗ trợ macOS

```bash
pnpm dist:mac    # macOS DMG (arm64)
```

### Cài đặt từ GitHub Releases (.dmg)

#### Bước 1: Tải file `.dmg` từ trang [Releases](https://github.com/LeHoangTuanbk/zenliro/releases) và cài đặt như bình thường.

#### Bước 2: Vì đây là ứng dụng mã nguồn mở không có code signing và notarization, macOS có thể chặn khi mở lần đầu:

![Apple can not check it for malicious software](docs/releases/assets/apple-can-not-check-software.png)

Để khắc phục, mở Terminal và chạy:

```bash
xattr -cr /Applications/Zenliro.app
```

#### Bước 3: Mở lại Zenliro.

### Chỉnh sửa ảnh bằng AI

Để sử dụng tính năng chỉnh sửa ảnh bằng AI, bạn cần tải và cài đặt Claude Code hoặc Codex CLI hoặc cả hai:

- **Claude Code**: https://code.claude.com/docs/en/overview
- **Codex CLI**: https://developers.openai.com/codex/cli

---

## TODO

- [ ] Sửa lỗi
- [ ] Thêm tính năng quản lý ảnh tốt hơn và phím tắt tiện lợi hơn
- [ ] Tối ưu hiệu suất xử lý ảnh
- [ ] Cải thiện Agent chỉnh sửa ảnh
- [ ] Hỗ trợ pipeline đa độ phân giải
- [x] Hỗ trợ định dạng ảnh RAW

---

## Cách đóng góp

1. Mở issue để thảo luận về những gì bạn muốn làm.
2. Sau khi thống nhất về hướng tiếp cận và chiến lược triển khai, fork repo.
3. Gửi PR với các thay đổi của bạn.
4. Cập nhật tài liệu và thêm test case nếu cần.

---

## Lấy cảm hứng từ

- [Lightroom Classic](https://www.adobe.com/products/photoshop-lightroom-classic.html)
- [RapidRAW](https://github.com/CyberTimon/RapidRAW)
- [Pencil](https://www.pencil.com)

---

## Giấy phép

Được cấp phép theo [AGPL-3.0](./LICENSE).

Nếu bạn phân phối hoặc triển khai phiên bản sửa đổi của Zenliro — bao gồm cả dưới dạng dịch vụ hosted — bạn phải công khai mã nguồn theo cùng giấy phép và ghi nhận dự án gốc.
