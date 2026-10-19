# 問・國立臺中科技大學 校園小幫手（API）

獨立服務：頁面在 [`DrChunChihChen/cv` 的 `campus/ask/`](https://drchunchihchen.github.io/cv/campus/ask/)，這個 repo 只放後端與知識庫。

| 檔案 | 用途 |
|---|---|
| `netlify/functions/ask.mts` | `POST /api/ask`：檢索知識庫 → OpenRouter 只依檢索到的條目回答 → 寫入 Google Sheet |
| `knowledge.json` | 知識庫。函式每 5 分鐘從 GitHub 讀一次，**改這個檔案不需要重新部署** |
| `rag.js` | 檢索（`campus/ask/rag.js` 是同一份，用於後端連不上時） |
| `google-sheet-log.gs` | 貼到 Google Sheet 的 Apps Script，寫入「提問紀錄」「回饋」兩個分頁 |

## Netlify 環境變數

| 變數 | 內容 |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter 金鑰（Scope: Functions） |
| `SHEET_WEBHOOK_URL` | Apps Script 網頁應用程式網址 |
| `SHEET_SECRET` | 與 `google-sheet-log.gs` 裡的 `SECRET` 相同 |
| `OPENROUTER_MODEL`（選填） | 預設 `anthropic/claude-haiku-5.5`（開啟 reasoning） |

每個瀏覽器每天 30 題、每個 IP 每天 300 題（Netlify Blobs 計數）。

## 知識庫條目

```json
{
  "id": "scooter-permit",
  "office": "課外活動指導組（課指組）",
  "place": "xuehuo",
  "floor": 3,
  "topics": ["機車停車證", "停車證"],
  "examples": ["機車停車證要怎麼辦"],
  "answer": "機車停車證要跑三個地方：…",
  "steps": [
    { "office": "課外活動指導組（課指組）", "place": "xuehuo", "floor": 3, "action": "繳交申請資料" },
    { "office": "出納組", "place": "xingzheng", "floor": null, "action": "繳費" },
    { "office": "事務組", "place": "xunxi", "floor": null, "action": "領取停車證" }
  ],
  "source": "使用者提供（2026-10-19）",
  "verified": true
}
```

- `place` 對照檔案開頭的 `places`；`floor` 不確定就填 `null`（AI 不會編樓層）。
- `steps` 選填，多站流程；地圖會逐站帶路（`campus/?flow=xuehuo.3~xingzheng~xunxi`）。
- `verified: false` 時 AI 會提醒「尚待確認」。
- 每週看一次 Sheet：狀態 `no-match` 或 👎 的問題，就是下一條要補的知識。

## 測試
```bash
npm install
npm test     # 檢索＋後端（模擬 OpenRouter，不需金鑰）
```
