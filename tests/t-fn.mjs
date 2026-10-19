// local test of the Netlify function with a fake OpenRouter + fake Sheet webhook
process.env.OPENROUTER_API_KEY = 'test'; process.env.SHEET_WEBHOOK_URL = 'https://sheet.example/exec'; process.env.SHEET_TOKEN = 't';
const logs = [];
globalThis.fetch = async (url, opt) => {
  if (String(url).includes('openrouter')){
    const body = JSON.parse(opt.body), user = body.messages[1].content, data = JSON.parse(user.slice(3, user.indexOf('\n\n問題')));
    const e = data[0];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: e.answer, office: e.office, place: e.place, floor: e.floor, entryId: e.id, confidence: e.verified ? 'high' : 'low' }) } }] }));
  }
  if (String(url).includes('sheet.example')){ logs.push(JSON.parse(opt.body)); return new Response('{"ok":true}'); }
  throw new Error('unexpected ' + url);
};
const { default: handler } = await import('../netlify/functions/ask.mjs');
const call = async b => { const r = await handler(new Request('https://x/api/ask', { method: 'POST', headers: { origin: 'https://example.github.io' }, body: JSON.stringify(b) }), { ip: '1.2.3.4' }); return [r.status, await r.json()]; };
for (const q of ['辦學貸要去哪', '機車停車證不見了', '五專假單交去哪', '3705', '今天天氣如何']){ const [st, j] = await call({ q }); console.log(st, q, '→', j.office, j.place, j.floor, j.source, '|', j.answer); }
console.log('feedback', (await call({ type: 'feedback', q: '辦學貸要去哪', helpful: true, id: 'student-loan' }))[0]);
console.log('sheet rows logged:', logs.length, logs[0].kind, logs[0].matched, '| token sent', logs[0].token === 't');
// LLM failure → fallback
globalThis.fetch = async url => { if (String(url).includes('openrouter')) return new Response('err', { status: 500 }); return new Response('{}'); };
const [, j] = await call({ q: '健康中心在哪' }); console.log('llm down →', j.source, j.office);
