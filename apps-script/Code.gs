/**
 * 「問」校園小幫手 — 提問紀錄
 * 1. 在 Google Sheet：擴充功能 → Apps Script，貼上本檔
 * 2. 專案設定 → 指令碼屬性：新增 TOKEN（自訂一串亂碼，和 Netlify 的 SHEET_TOKEN 相同）
 * 3. 部署 → 新增部署作業 → 網頁應用程式：執行身分「我」、存取權「所有人」→ 複製網址填到 Netlify 的 SHEET_WEBHOOK_URL
 */
const HEAD = {
  ask: ['時間', '問題', '回答', '單位', '地點', '樓層', '信心', '來源', '檢索到的條目', '語言', '入口'],
  feedback: ['時間', '問題', '單位', '有幫助', '條目'],
};

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token || d.token !== token) return out({ ok: false, error: 'unauthorized' });
    const kind = d.kind === 'feedback' ? 'feedback' : 'ask';
    const sh = sheet(kind === 'ask' ? '提問紀錄' : '回饋', HEAD[kind]);
    const now = new Date();
    const row = kind === 'ask'
      ? [now, d.q, d.answer, d.office, d.place, d.floor, d.confidence, d.source, d.matched, d.lang, d.entry]
      : [now, d.q, d.office, d.helpful ? '👍' : '👎', d.entryId];
    sh.appendRow(row.map(clean));
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

// avoid formula injection from user text (=, +, -, @ at the start)
function clean(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }

function sheet(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); }
  return sh;
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
