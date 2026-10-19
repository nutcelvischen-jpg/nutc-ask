// 「問」校園小幫手 提問紀錄：貼到 Google Sheet 的「擴充功能 → Apps Script」
// 1. 把下面 SECRET 換成你自己的一串亂碼（同一串也要貼到 Netlify 的 SHEET_SECRET）
// 2. 部署 → 新增部署作業 → 網頁應用程式：執行身分「我」、存取權「所有人」→ 網址貼到 Netlify 的 SHEET_WEBHOOK_URL
const SECRET = '換成你自己的一串亂碼';

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (_) { return out('bad request'); }
  if (!d || d.secret !== SECRET) return out('forbidden');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 開頭是 = + - @ 的文字前面加 '，避免被當成公式
  const safe = v => { v = String(v ?? '').slice(0, 2000); return /^[=+\-@]/.test(v) ? "'" + v : v; };
  if (d.kind === 'feedback') {
    const sh = sheet(ss, '回饋', ['時間', '問題', '單位', '有幫助', '條目']);
    sh.appendRow([new Date(), safe(d.question), safe(d.office), d.helpful ? '👍' : '👎', safe(d.entryId)]);
  } else {
    const sh = sheet(ss, '提問紀錄', ['時間', '問題', '回答', '單位', '地點', '樓層', '狀態', '檢索到的條目']);
    sh.appendRow([new Date(), safe(d.question), safe(d.answer), safe(d.office), safe(d.place), safe(d.floor), safe(d.status), safe(d.matched)]);
  }
  return out('ok');
}

function sheet(ss, name, head) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}

function out(t) { return ContentService.createTextOutput(t); }
