import fs from 'fs'; import { retrieve, localAnswer } from '../rag.js';
const kb = JSON.parse(fs.readFileSync(new URL('../knowledge.json', import.meta.url),'utf8'));
for (const q of ['辦學貸要去哪','我的機車停車證掉了','五專要交假單','健康中心在哪','我要辦休學','肚子好餓','3705 怎麼走','國際生簽證','想打籃球','開車來要停哪','機車要停哪裡','今天天氣如何','宿舍','教務處在哪','我想借書']){
  const a = localAnswer(kb, q); console.log(q.padEnd(12,'　'), '→', a ? `${a.office} @${a.place}${a.floor?' '+a.floor+'F':''} [${a.confidence}]` : '（無）', a && a.also.length ? '| also ' + a.also.map(x=>x.office).join(',') : '');
}
