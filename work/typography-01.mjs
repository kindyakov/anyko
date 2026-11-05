const fs=await import('node:fs/promises'); const crypto=await import('node:crypto');
const root='E:/WORK/anyko/docs/brand'; await fs.mkdir(root+'/assets/fonts',{recursive:true});
const manifest=[];
for(const family of ['Onest','Manrope','Unbounded']){
 const base='https://raw.githubusercontent.com/google/fonts/main/ofl/'+family.toLowerCase()+'/';
 const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(url+' '+r.status);return r};
 const metadata=await (await get(base+'METADATA.pb')).text();
 const name=metadata.match(/filename:\s*"([^"]+)"/)[1];
 const bytes=Buffer.from(await (await get(base+encodeURIComponent(name))).arrayBuffer());
 if(bytes.readUInt32BE(0)!==0x00010000)throw Error('Not TTF '+family);
 await fs.writeFile(root+'/assets/fonts/'+family+'.ttf',bytes);
 await fs.writeFile(root+'/assets/fonts/'+family+'-OFL.txt',await (await get(base+'OFL.txt')).text());
 await fs.writeFile(root+'/assets/fonts/'+family+'-METADATA.pb',metadata);
 manifest.push({family,source:base+encodeURIComponent(name),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cyrillic:metadata.includes('"cyrillic"')});
}
await fs.writeFile(root+'/assets/fonts/sources.json',JSON.stringify({downloaded:'2026-11-04',fonts:manifest},null,2));
let html=await fs.readFile(root+'/brandbook.html','utf8');
html=html.replaceAll('1.0','1.1');
const extra=`
h1,h2,h3,h4,.type-xl,.quote{font-family:var(--anyko-font-heading)}
.font-sample{padding:30px;border:1px solid #ded9dd;border-radius:16px;background:#fff;margin-top:18px}
.font-sample .sample-name{font-family:var(--anyko-font);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#65616a;margin-bottom:18px}
.font-sample .sample-text{margin:0 0 20px;line-height:1.28;letter-spacing:-.025em}
.font-sample .sample-desc{font-family:var(--anyko-font);font-size:14px;color:#65616a;max-width:740px;margin:0}
.font-sample.body-font .sample-text{font:400 24px/1.55 var(--anyko-font);max-width:750px}
.font-sample.heading-font .sample-text{font:800 clamp(30px,4vw,48px)/1.15 var(--anyko-font-heading)}
.font-sample.display-font{background:#201114;color:#fafafa;border-color:#6d0c1f}
.font-sample.display-font .sample-name,.font-sample.display-font .sample-desc{color:#c9bfc3}
.font-sample.display-font .sample-text{font:600 clamp(26px,4vw,54px)/1.15 var(--anyko-font-display);letter-spacing:-.025em;color:#fafafa}
.font-sample.display-font .sample-text span{color:#f33647}
.font-alphabet{font-size:17px;line-height:1.8;margin:16px 0 0;overflow-wrap:anywhere}
.font-sample.display-font .font-alphabet{font-family:var(--anyko-font-display);font-size:15px;color:#c9bfc3}
@media(max-width:760px){.font-sample{padding:22px}.font-sample.body-font .sample-text{font-size:20px}.font-sample.display-font .sample-text{font-size:26px}}
`;
html=html.replace('</style>',extra+'\n</style>');
const a=html.indexOf('<section id="type">'),b=html.indexOf('<section id="product">');if(a<0||b<a)throw Error('Missing section');
const specimen=`<section id="type"><div class="section-head"><div class="num">05 / ТИПОГРАФИКА</div><div><h2>Три голоса.<br>Один характер.</h2><p>Onest — для повседневной работы. Manrope — для сильных заголовков. Unbounded — когда композиции нужен необычный, запоминающийся акцент. Все три семейства подключены локально с кириллицей.</p></div></div>
<div class="font-sample body-font"><div class="sample-name">01 / Onest · основной · 400–600</div><p class="sample-text">Проверьте сведения из загруженных документов. Для каждой суммы можно открыть источник и уточнить данные.</p><div class="type-num" style="font-family:var(--anyko-font);margin:0 0 18px">450 000,50 ₽</div><p class="sample-desc">Абзацы, поля, таблицы, навигация, кнопки и подписи. Читаемый текст, который не спорит с содержанием.</p><div class="font-alphabet">Аа Бб Вв Гг Дд Ее Ёё Жж Зз · 0123456789 · № ₽</div></div>
<div class="font-sample heading-font"><div class="sample-name">02 / Manrope · заголовочный · 600–800</div><p class="sample-text">Каждый факт<br>на своём месте.</p><p class="sample-desc">Заголовки страниц, разделов, карточек и основной текст обложки. Геометрический рисунок и плотное начертание создают уверенный ритм.</p><div class="font-alphabet" style="font-family:var(--anyko-font-heading);font-weight:700">Аа Бб Вв Гг Дд Ее Ёё Жж Зз · 0123456789</div></div>
<div class="font-sample display-font"><div class="sample-name">03 / Unbounded · акцидентный · 500–700</div><p class="sample-text">Всё<br><span>сходится.</span></p><p class="sample-desc">Редкий акцент для обложки, кампании или специальной композиции. Широкий, немного странный и футуристичный — в характере Анико. Фраза здесь показывает набор, а не подтверждает проверку дела.</p><div class="font-alphabet">Аа Бб Вв Гг Дд Ее Ёё Жж Зз</div></div>
<div class="note"><b>Один акцент на композицию.</b> Unbounded — для 1–4 слов, не для форм, реквизитов и длинных текстов. В рабочем кабинете обычно достаточно Onest + Manrope. Шрифты итогового Word определяет юридический шаблон.</div>
<div class="grid2" style="margin-top:24px"><div class="card"><h3>Размер и ритм</h3><div class="rule"><b>Manrope / обложка</b><span>48–72 px · 800</span></div><div class="rule"><b>Manrope / раздел</b><span>28–40 px · 700–800</span></div><div class="rule"><b>Onest / текст</b><span>16 px · 400</span></div><div class="rule"><b>Onest / поля</b><span>14–16 px · 400–600</span></div><div class="rule"><b>Unbounded / акцент</b><span>32–64 px · 500–700</span></div></div><div class="card"><h3>Применение</h3><p>Без искусственного сжатия и растягивания. Для сумм — табличные цифры. Для узкой карточки — Manrope вместо широкого Unbounded.</p><p style="margin-top:16px">Логотип сохраняет прежнюю надпись: новая типографика применяется к текстам бренда и интерфейсу.</p><p style="margin-top:16px"><a href="assets/fonts/sources.json">Источники шрифтов</a> · лицензии находятся рядом с файлами.</p></div></div></section>
`;
html=html.slice(0,a)+specimen+html.slice(b);
await fs.writeFile(root+'/brandbook.html',html);
let readme=await fs.readFile(root+'/README.md','utf8');readme=readme.replace('Версия 1.0','Версия 1.1');readme+='\nТипографика: **Onest** — основной, **Manrope** — заголовки, **Unbounded** — редкие акценты. Файлы и лицензии хранятся в `assets/fonts/`.\n';await fs.writeFile(root+'/README.md',readme);
const task=await taskSpace('Anyko typography review');const page=task.page('p1');await page.goto('file:///E:/WORK/anyko/docs/brand/brandbook.html');
await page.evaluate(async()=>{await Promise.all([document.fonts.load('400 16px Onest','Проверка Ёё'),document.fonts.load('800 48px Manrope','Заголовок'),document.fonts.load('600 48px Unbounded','Всё сходится')]);await document.fonts.ready;document.querySelector('#type').scrollIntoView({behavior:'instant'});});
await page.screenshot({path:'E:/WORK/anyko/work/typography-desktop.png'});
console.log({spaceId:task.spaceId,fonts:manifest});
console.log(await page.evaluate(()=>({fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),overflow:document.documentElement.scrollWidth>innerWidth})));
