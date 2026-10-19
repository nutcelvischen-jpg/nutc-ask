// Shared retrieval for the 問 assistant — used by the Netlify function and by the page as an offline fallback.
// Chinese-friendly scoring without embeddings: exact topic hits weigh most, then character-bigram overlap.

const norm = s => String(s || '').toLowerCase().replace(/[\s，。？！、；：「」『』（）()?!,.:;"'·・\-]/g, '');
const bigrams = s => { const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; };

/** Room code such as 3705 → { place, floor, code } using knowledge.roomCodes. */
export function roomCode(kb, q){
  const m = norm(q).match(/([3-8])([1-9])\d{2}[a-z]?/);
  if (!m || !kb.roomCodes[m[1]]) return null;
  return { place: kb.roomCodes[m[1]], floor: +m[2], code: m[0].toUpperCase() };
}

/** Top-k entries for a question, each with a score; empty when nothing is relevant. */
export function retrieve(kb, q, k = 5){
  const s = norm(q); if (!s) return [];
  const qb = bigrams(s);
  const scored = kb.entries.map(e => {
    let score = 0;
    for (const t of e.topics){ const n = norm(t); if (n && s.includes(n)) score += 3 * n.length; }
    const office = norm(e.office.replace(/（.*?）/g, '')); if (office && s.includes(office)) score += 2 * office.length;
    const placeName = norm(kb.places[e.place] || ''); if (placeName && s.includes(placeName)) score += 1.5;
    let overlap = 0; const text = norm([...e.examples, ...e.topics, e.office].join('|'));
    for (const b of qb) if (text.includes(b)) overlap++;
    score += overlap * .8;
    if (!e.verified) score *= .9;
    return { e, score };
  }).filter(x => x.score >= 2.4).sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/** Plain answer straight from the knowledge base (no LLM). */
export function localAnswer(kb, q){
  const rc = roomCode(kb, q);
  if (rc) return { answer: `教室編號第 1 碼是大樓、第 2 碼是樓層：${rc.code} 在${kb.places[rc.place]} ${rc.floor} 樓。`, office: `${rc.code} 教室`, place: rc.place, floor: rc.floor, entryId: null, confidence: 'high', also: [] };
  const hits = retrieve(kb, q, 3);
  if (!hits.length) return null;
  const top = hits[0].e;
  return { answer: top.answer + (top.verified ? '' : '（此資訊尚待確認，建議先電話詢問。）'), office: top.office, place: top.place, floor: top.floor, entryId: top.id, steps: top.steps || null,
    confidence: top.verified ? 'medium' : 'low', also: hits.slice(1).filter(h => h.e.office !== top.office).map(h => ({ office: h.e.office, id: h.e.id })) };
}
