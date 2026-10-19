// POST /api/ask  — 問 assistant backend (Netlify Functions v2)
// body: { q: "我要辦學貸", lang: "zh" | "en", entry: "sanmin" | "zhonghua" }
//    or { type: "feedback", id, helpful: true|false, q, office }
// Flow: room-code shortcut → retrieve from knowledge.json (RAG) → OpenRouter LLM constrained to those entries
//       → validate the place id → log to Google Sheet (Apps Script) → JSON to the page.
import bundledKB from '../../knowledge.json' with { type: 'json' };
import { retrieve, roomCode, localAnswer } from '../../rag.js';

const env = k => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k] ?? '';
const MODEL = () => env('OPENROUTER_MODEL') || 'google/gemini-2.5-flash';

// knowledge lives in the GitHub repo; fetch the published copy so a git push updates answers without redeploying
let kbCache = { at: 0, kb: bundledKB };
async function loadKB(){
  const url = env('KNOWLEDGE_URL');
  if (!url || Date.now() - kbCache.at < 5 * 60e3) return kbCache.kb;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (r.ok){ const kb = await r.json(); if (Array.isArray(kb.entries)) kbCache = { at: Date.now(), kb }; }
  } catch {}
  kbCache.at = Date.now();
  return kbCache.kb;
}

// light per-instance rate limit (best effort; instances are short-lived)
const hits = new Map();
function limited(ip){
  const now = Date.now(), w = (hits.get(ip) || []).filter(t => now - t < 60e3); w.push(now); hits.set(ip, w);
  return w.length > 20;
}

function cors(req){
  const allow = env('ALLOWED_ORIGINS').split(',').map(s => s.trim()).filter(Boolean), origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': !allow.length || allow.includes(origin) ? (origin || '*') : allow[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin',
  };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) } });

function systemPrompt(kb, lang){
  const places = Object.entries(kb.places).map(([id, n]) => `${id}=${n}`).join('、');
  return `你是國立臺中科技大學三民校區的「問」校園小幫手。學生或訪客會問「要去哪裡、要做什麼事」。
規則：
1. 只能根據下方「資料」回答，不可自行推測單位、樓層或流程。資料沒有涵蓋時，answer 說明不確定，建議洽詢學務處或校安中心，place 設為 null。
2. 回答精簡：1～2 句，先說去哪個單位、在哪棟幾樓，必要時補一句要帶什麼或注意什麼（資料有寫才說）。
   資料有 steps（多站流程）時，依順序用「先…再…最後…」說明每一站，place/floor 填第一站，entryId 填該條 id。樓層為 null 時不要編造樓層。
3. 資料標記 verified=false 時，在回答最後加上「（此資訊尚待確認，建議先電話詢問）」。
4. 使用臺灣繁體中文與臺灣用語${lang === 'en' ? '；使用者用英文提問時，以英文回答' : ''}。
5. place 只能是這些 id 之一：${places}；floor 為數字或 null。
只輸出 JSON：{"answer": string, "office": string|null, "place": string|null, "floor": number|null, "entryId": string|null, "confidence": "high"|"medium"|"low"}`;
}

async function callLLM(kb, q, hitsList, lang){
  const key = env('OPENROUTER_API_KEY'); if (!key) throw new Error('no key');
  const data = hitsList.map(({ e }) => ({ id: e.id, office: e.office, place: e.place, placeName: kb.places[e.place], floor: e.floor, room: e.room || undefined, answer: e.answer, steps: e.steps || undefined, verified: e.verified }));
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(9000),
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': env('SITE_URL') || 'https://nutc-ask.netlify.app', 'X-Title': 'NUTC 問' },
    body: JSON.stringify({
      model: MODEL(), temperature: 0.2, max_tokens: 400, response_format: { type: 'json_object' },
      messages: [ { role: 'system', content: systemPrompt(kb, lang) }, { role: 'user', content: `資料：${JSON.stringify(data)}\n\n問題：${q}` } ],
    }),
  });
  if (!r.ok) throw new Error('llm ' + r.status);
  const out = await r.json(), text = out.choices?.[0]?.message?.content || '';
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  return parsed;
}

async function logToSheet(row){
  const url = env('SHEET_WEBHOOK_URL'); if (!url) return;
  try { await fetch(url, { method: 'POST', signal: AbortSignal.timeout(3000), headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ token: env('SHEET_TOKEN'), ...row }) }); } catch {}
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);
  let body; try { body = await req.json(); } catch { return json(req, { error: 'bad json' }, 400); }
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'anon';
  if (limited(ip)) return json(req, { error: '問得有點快，請稍等一下再試。' }, 429);
  const later = p => context?.waitUntil ? context.waitUntil(p) : p;

  // 👍 / 👎 feedback
  if (body.type === 'feedback'){
    later(logToSheet({ kind: 'feedback', q: String(body.q || '').slice(0, 200), office: body.office || '', helpful: !!body.helpful, entryId: body.id || '' }));
    return json(req, { ok: true });
  }

  const q = String(body.q || '').trim().slice(0, 200), lang = body.lang === 'en' ? 'en' : 'zh';
  if (!q) return json(req, { error: 'empty' }, 400);
  const kb = await loadKB();

  let res, source = 'llm';
  const rc = roomCode(kb, q);
  const top = retrieve(kb, q, 5);
  if (rc){ res = localAnswer(kb, q); source = 'room-code'; }
  else if (!top.length){ res = { answer: '這題我還不確定。可以換個說法，或直接說單位、地點、教室編號；也可以到昌明樓 1 樓學務處詢問。', office: null, place: null, floor: null, entryId: null, confidence: 'low' }; source = 'no-match'; }
  else {
    try {
      res = await callLLM(kb, q, top, lang);
      if (res.place && !kb.places[res.place]) res.place = null;          // never send the map to a place we don't have
      if (res.entryId && !kb.entries.some(e => e.id === res.entryId)) res.entryId = null;
      if (typeof res.floor !== 'number') res.floor = null;
    } catch (err){ res = localAnswer(kb, q); source = 'fallback'; }
  }
  // multi-stop flows come straight from the knowledge base, never from the model
  const ent = res.entryId && kb.entries.find(e => e.id === res.entryId);
  res.steps = ent && ent.steps ? ent.steps.filter(st => kb.places[st.place]) : (res.steps && source !== 'llm' ? res.steps : null);
  res.also = top.slice(1, 3).filter(h => h.e.office !== res.office).map(h => ({ office: h.e.office, id: h.e.id }));
  res.source = source;

  later(logToSheet({ kind: 'ask', q, answer: res.answer, office: res.office || '', place: res.place || '', floor: res.floor ?? '', confidence: res.confidence, source,
    matched: top.map(h => h.e.id).join(','), lang, entry: body.entry || '' }));
  return json(req, res);
};

export const config = { path: '/api/ask' };
