# 問・國立臺中科技大學 校園小幫手

「要去哪裡？要做什麼事？問就對了。」學生輸入問題，AI 依校內資料回答該去哪個單位、哪棟幾樓，並一鍵開啟 3D 地圖帶路。

## 架構

| 角色 | 放哪裡 | 檔案 |
|---|---|---|
| 前端 | GitHub Pages | `index.html`（問）、`map.html`（3D 地圖）、`sketch.html`（手繪版） |
| RAG 知識庫 | GitHub（同一個 repo） | `knowledge.json`、`rag.js`（檢索，前後端共用） |
| 後端 API | Netlify Functions | `netlify/functions/ask.mjs` → `POST /api/ask` |
| 紀錄 | Google Sheet | `apps-script/Code.gs`（「提問紀錄」「回饋」兩個分頁） |

流程：問題 → 教室編號直接判斷 → 從 `knowledge.json` 檢索最相關 5 條 → OpenRouter 模型只能依這幾條回答 → 檢查地點 id → 寫入 Sheet → 回傳前端畫小地圖與「帶我去」。
後端連不上時，前端自動改用 `knowledge.json` 直接回答。

## 部署步驟

### 1. GitHub Pages（前端＋知識庫）
1. 建 repo，放入本資料夾全部檔案並推上去。
2. Settings → Pages → Branch `main` / root。網址如 `https://<帳號>.github.io/<repo>/`。

### 2. Google Sheet（紀錄）
1. 新建試算表 → 擴充功能 → Apps Script，貼上 `apps-script/Code.gs`。
2. 專案設定 → 指令碼屬性：新增 `TOKEN`（自訂一串亂碼）。
3. 部署 → 新增部署作業 → 網頁應用程式：執行身分「我」、存取權「所有人」→ 複製網址。

### 3. Netlify（後端）
1. Add new site → Import from GitHub → 選同一個 repo（`netlify.toml` 已設定）。
2. Site configuration → Environment variables：

| 變數 | 內容 |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter 金鑰 |
| `OPENROUTER_MODEL` | OpenRouter 上的模型 id，例如 `google/gemini-2.5-flash` |
| `KNOWLEDGE_URL` | `https://<帳號>.github.io/<repo>/knowledge.json`（推上 GitHub 即生效，5 分鐘快取） |
| `SHEET_WEBHOOK_URL` | 第 2 步的 Apps Script 網址 |
| `SHEET_TOKEN` | 與 Apps Script 的 `TOKEN` 相同 |
| `ALLOWED_ORIGINS` | `https://<帳號>.github.io` |

3. 重新部署後，API 網址為 `https://<站名>.netlify.app/api/ask`。

### 4. 接上前端
`index.html` 開頭的這一行填入 API 網址：
```html
<meta name="ask-api" content="https://<站名>.netlify.app/api/ask">
```

## 維護知識庫（knowledge.json）

```json
{
  "id": "student-loan",
  "office": "課外活動指導組（課指組）",
  "place": "xuehuo",
  "floor": 3,
  "room": "",
  "topics": ["就學貸款", "學貸"],
  "examples": ["辦學貸要去哪"],
  "answer": "就學貸款到學生活動中心 3 樓的課外活動指導組（課指組）辦理。",
  "source": "使用者提供（2026-10-19）",
  "verified": true
}
```

- `place`：地點 id，對照檔案開頭的 `places`。
- `topics`：關鍵字，命中權重最高；`examples`：學生可能的問法。
- `verified: false`：AI 會提醒「此資訊尚待確認」。
- `steps`（選填）：要跑多個地方的流程。前端會列出 1、2、3 站，「依序帶我走」會在 3D 地圖逐站帶路：

```json
"steps": [
  { "office": "課外活動指導組（課指組）", "place": "xuehuo", "floor": 3, "action": "繳交申請資料" },
  { "office": "出納組", "place": "xingzheng", "floor": null, "action": "繳費" },
  { "office": "事務組", "place": "xunxi", "floor": null, "action": "領取停車證" }
]
```

## 3D 地圖深連結
- `map.html#changming.1`：開昌明樓 1 樓並畫路線
- `map.html#flow:xuehuo.3~xingzheng~xunxi`：多站流程，到站後按「下一站」

建議每週看一次 Sheet：來源為 `no-match` 或回饋 👎 的問題，就是下一條要補的知識。

## 本機預覽與測試
```bash
python3 -m http.server   # 開 http://localhost:8000
npm test                 # 檢索與後端測試（模擬 LLM，不需金鑰）
```
