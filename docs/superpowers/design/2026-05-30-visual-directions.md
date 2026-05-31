# PV 視覺方向提案與決策紀錄

> Plan: `docs/superpowers/plans/2026-05-30-visual-uplift.md`（Task 2 決策檢查點）
> 產品脈絡：訂閱到期管理工具（login / admin 列表 / config 設定）。
> 硬限制：續用 Tailwind v4 + DaisyUI + hono/jsx，不更換框架、不改 API/路由、不破壞 DaisyUI 元件語意；
> 改動須能表達為 DaisyUI 主題 token + Tailwind `@theme` + class 級別微調。
> 反通用要求（spec §6）：字體避免 Inter/Roboto/系統字；配色避免「紫漸層白底」AI 風；動效 CSS-only、聚焦載入時刻。

## Baseline（改動前）

Plan 2 harness 產出，作為前後對比基準：

- `e2e/__screenshots__/baseline/login.png`
- `e2e/__screenshots__/baseline/admin.png`
- `e2e/__screenshots__/baseline/admin-config.png`

現況：`src/style.css` 僅覆寫 `--color-primary: #36A45D`（綠），其餘為 DaisyUI 預設（通用、缺記憶點）。字體為系統 sans。

## 提案方向（mockup 已產出，截圖見各 `e2e/__screenshots__/direction-<n>/`）

三個方向皆已暫態套入 `src/style.css` 並經 harness 截圖（login / admin / admin-config），截圖後已 revert，工作樹 `src/style.css` 維持 baseline 狀態。

---

### Direction 1 — Ledger／帳本（暖色編輯風）

**理念**：像一本精裝財務帳本。沉穩、可信、有編輯感的紙感介面，延續品牌綠但加深為植物森綠，以赭黃作為到期/警示語意色。最不「AI」、最有人味的一案。

- **字體**：標題 `Fraunces`（光學尺寸軟襯線，記憶點強）／內文 `Hanken Grotesk`（人文無襯線，表格易讀）
- **配色（light）**：primary `#2F6B43`、secondary `#8C6D4F`(皮革棕)、accent `#C8852B`(赭黃)、base-100 `#FBF7F0`(紙)、base-200 `#F3ECE0`、base-300 `#E6DBC9`、base-content `#1F1B16`(墨)、success `#3E7D52`、warning `#C8852B`、error `#A8412B`、info `#4A6D7C`
- **配色（dark）**：base-100 `#1B1813`、primary `#6FB07F`、accent `#E2A155`、base-content `#ECE3D4`
- **圓角／間距**：box `0.5rem`、field `0.375rem`（俐落紙緣，邊框 1px）
- **載入動效**：卡片 `translateY(10px)→0` + fade，`0.42s` ease-out，沉穩落定

### Direction 2 — Console／終端（深色技術風）

**理念**：開發者儀表板美學。深色優先、高訊噪比、數字用等寬字、節制的霓虹強調色。對「tracker」這類工具特別有記憶點。預設主題即為深色調。

- **字體**：標題＋內文 `Space Grotesk`（幾何感，非 Inter）／數字 `IBM Plex Mono`（價格、日期等寬對齊）
- **配色（預設深色）**：primary `#2DD4BF`(電青)、accent `#FB7185`(珊瑚玫瑰／到期急迫)、secondary `#94A3B8`、base-100 `#0F1419`、base-200 `#161C24`、base-300 `#1F2730`、base-content `#C9D5E1`、success `#34D399`、warning `#FBBF24`、error `#F87171`、info `#38BDF8`
- **圓角／間距**：box/field `0.25rem`（銳利、技術感）；表格 `tabular-nums`
- **載入動效**：`translateY(6px)→0` + fade，`0.2s` ease-out，快速俐落

### Direction 3 — Bloom／礦彩（柔和現代風）

**理念**：親和的消費級 App，柔軟好親近但刻意避開「紫漸層」通用風。寶石礦物色（teal 主、coral 強調）、大圓角、留白充裕、溫暖人性。

- **字體**：標題 `Bricolage Grotesque`（現代有個性）／內文 `Onest`（清晰圓潤）
- **配色（light）**：primary `#0D9488`(寶石青)、secondary `#5B86C4`(藍，非紫)、accent `#F97362`(珊瑚)、base-100 `#F8FAF9`(冷暖白)、base-200 `#EFF3F2`、base-300 `#E2E9E7`、base-content `#18211F`、success `#16A34A`、warning `#F59E0B`、error `#EF4444`、info `#0EA5E9`
- **配色（dark）**：base-100 `#10161A`、primary `#2DD4BF`、accent `#FB8A7A`
- **圓角／間距**：box `1rem`、field `0.75rem`（大圓角、pill 按鈕、airy）
- **載入動效**：`translateY(12px)+scale(0.99)→0` + fade，`0.38s` 帶輕微 overshoot 的彈性曲線

---

## 選定方向 — Starbucks DESIGN.md（使用者於 2026-05-30 核可）

> 來源：getdesign.md → `npx getdesign add starbucks`，完整 spec 置於 repo 根 `DESIGN.md`（580 行）。
> 選定理由：三個 green-lineage 候選中唯一同時滿足（1）保留既有綠色品牌 #36A45D 血緣、(2) light-first 暖色（不像 supabase 翻成 dark-first）、(3) 反通用（color-block 無漸層、非紫）、(4) 完整 token 系統。
> 落地點：`src/style.css`（DaisyUI 主題 + Tailwind `@theme` + 簽名級 class 規則），主題 cascade 涵蓋全頁，未動 `src/pages/**` JSX 與 island 綁定。

### 字體
- 內文／標題：`Manrope`（DESIGN.md §3 指定的 SoDoSans 開源替代；非 Inter/Roboto/系統字）
- 字距：全域 `-0.01em`（標題 `-0.016em`），weight-led 階層（H1/H2 同尺寸、以字重與色彩分層）

### 配色（light）
| Role | Token | Hex |
|------|-------|-----|
| primary（CTA） | Green Accent | `#00754A` |
| secondary（深綠帶） | House Green | `#1E3932` |
| accent（ceremony，節制） | Gold | `#CBA258` |
| base-100（卡片/nav） | White | `#FFFFFF` |
| base-200（頁面畫布） | Neutral Warm 暖奶油 | `#F2F0EB` |
| base-300（hover/分隔） | Ceramic | `#EDEBE9` |
| base-content | 暖近黑 | `#1F1C19` |
| info | Green Uplift | `#2B5148` |
| success | brand green | `#00754A` |
| warning | 暖琥珀 | `#E0892B` |
| error | Starbucks Red | `#C82014` |

### 配色（dark — House-Green espresso）
primary `#34A877`、secondary `#2B5148`、accent `#D9B574`、base-100 `#1E3932`、base-200 `#16302A`、base-300 `#25463E`、base-content `#EAF1ED`、success `#34A877`、warning `#E0B15A`、error `#E5685E`、info `#6FA395`。

### 圓角／間距
- `--radius-box: 0.75rem`（12px 卡片/modal）、`--radius-field: 0.5rem`（輸入框）、`--radius-selector: 1rem`
- 按鈕一律 full-pill（`.btn { border-radius: 9999px }`），簽名互動 `:active { scale(0.95) }` + `0.2s ease`

### 動效
- 載入時刻 `sb-rise`：`translateY(8px)→0` + fade，`0.36s` `cubic-bezier(0.25,0.46,0.45,0.94)`（DESIGN.md expander 曲線，café-calm）
- 卡片 whisper-soft 疊層陰影（取代單一重陰影）：`0 0 .5px /.14 + 0 1px 2px /.10 + 0 6px 16px /.06`

### PWA
- `Layout.tsx` `<meta name="theme-color">`：`#36A45D` → `#00754A`

## 落選方向（供日後參考）
- **supabase**（dark emerald, code-first）：保留綠色但需翻成 dark-first，與既有 light app 落差大。
- **mintlify**（clean light, green-accented）：偏文件閱讀風，記憶點與品牌綠張力較弱。
- 早期自擬三方向（Ledger 暖編輯／Console 深色終端／Bloom 柔和現代）：未採用，改以 getdesign.md 的 production-grade DESIGN.md 為依據。

## 前後對比審查結論

- **核可日期**：2026-05-30，使用者於 PV gate 回覆「Approve」。
- **對比要點**（baseline → starbucks，三頁 `e2e/__screenshots__/{baseline,starbucks}/`）：
  - login：純白 → 暖奶油畫布 + 白卡，CTA 由方角綠轉為 Green Accent full-pill。
  - admin：通用 DaisyUI → 白 nav/卡 浮於奶油畫布，列操作鈕為四階綠 pill（編輯/測試/刪除/停用）。
  - config：分頁底線與「保存配置」改 Green Accent，輸入框 12px 圓角、表單分組沿用 base 階層。
- **遺留事項**：截圖刻意不入庫（依使用者先前指示）；whisper-soft 陰影與 gold 之後可於 P7 視需要再微調。
