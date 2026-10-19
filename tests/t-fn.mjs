// Local test of netlify/functions/ask.mts with a fake OpenRouter and a fake Sheet webhook.
// Run: node --experimental-strip-types tests/t-fn.mjs
const env = { OPENROUTER_API_KEY: 'test', SHEET_WEBHOOK_URL: 'https://sheet.example/exec', SHEET_SECRET: 's' };
globalThis.Netlify = { env: { get: k => env[k] } };
const logs = [];
globalThis.fetch = async (url, opt) => {
  url = String(url);
  if (url.includes('raw.githubusercontent')) return new Response('nope', { status: 404 }); // force bundled knowledge.json
  if (url.includes('openrouter')){
    const user = JSON.parse(opt.body).messages[1].content, data = JSON.parse(user.slice(3, user.indexOf('\n\n<question>'))), e = data[0];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: e.answer, office: e.office, place: e.place, floor: e.floor, entryId: e.id, confidence: 'high' }) } }] }));
  }
  if (url.includes('sheet.example')){ logs.push(JSON.parse(opt.body)); return new Response('ok'); }
  throw new Error('unexpected ' + url);
};
const { default: handler } = await import('../netlify/functions/ask.mts');
const ctx = { ip: '1.2.3.4', waitUntil: p => p };
const call = async (b, origin = 'https://drchunchihchen.github.io') => { const r = await handler(new Request('https://x/api/ask', { method: 'POST', headers: { origin }, body: JSON.stringify(b) }), ctx); return [r.status, await r.json()]; };
for (const q of ['辦學貸要去哪', '機車停車證要怎麼辦', '五專假單交去哪', '3705', '今天天氣如何']){
  const [st, j] = await call({ q, vid: 'test-visitor-01' });
  console.log(st, q, '→', j.office, j.place, j.floor, j.steps ? `steps:${j.steps.length}` : '', '|', j.answer);
}
console.log('forbidden origin:', (await call({ q: 'x' }, 'https://evil.example'))[0]);
console.log('feedback:', (await call({ type: 'feedback', q: '辦學貸要去哪', helpful: true, id: 'student-loan' }))[0]);
console.log('sheet rows:', logs.length, logs[0].kind, logs[0].status, '| secret sent', logs[0].secret === 's');
env.OPENROUTER_API_KEY = '';
const [, j] = await call({ q: '健康中心在哪', vid: 'test-visitor-01' }); console.log('no key →', j.office, '| logged status', logs.at(-1).status);
