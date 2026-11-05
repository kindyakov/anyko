const task = await taskSpace('Anyko brandbook source');
const page = task.page('p1');
try { await page.goto('https://anyko.vercel.app/'); } catch(e) { console.log(String(e)); }
console.log({spaceId:task.spaceId});
console.log(await page.evaluate(()=>({svgs:[...document.querySelectorAll('svg')].map((e,i)=>({i,viewBox:e.getAttribute('viewBox'),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,parent:e.parentElement.textContent.slice(0,100),length:e.outerHTML.length})).filter(e=>e.length>2000),header:document.querySelector('a[href="/"]')?.outerHTML,fonts:[...document.querySelectorAll('a[href="/"] *,h1')].map(e=>({tag:e.tagName,text:e.textContent.slice(0,60),font:getComputedStyle(e).fontFamily,weight:getComputedStyle(e).fontWeight})),vars:[...getComputedStyle(document.documentElement)].filter(x=>x.startsWith('--')).map(x=>[x,getComputedStyle(document.documentElement).getPropertyValue(x)]).filter(x=>/color|background|primary|font|border|muted|radius/.test(x[0]))})));
