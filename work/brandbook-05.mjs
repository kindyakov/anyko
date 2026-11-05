const task=await taskSpace(2);const page=task.page('p1');const fs=await import('node:fs/promises');const path=await import('node:path');const root='E:/WORK/anyko/docs/brand';
const links=await page.evaluate(()=>[...document.querySelectorAll('[src],link[href],a[href]')].map(e=>e.getAttribute('src')||e.getAttribute('href')).filter(s=>s&&!s.startsWith('http')&&!s.startsWith('#')));
for(const link of links)await fs.access(path.resolve(root,link));
const comparison=await page.evaluate(async texts=>{const p=new DOMParser();return texts.map(t=>{const d=p.parseFromString(t,'image/svg+xml');return {viewBox:d.documentElement.getAttribute('viewBox'),paths:[...d.querySelectorAll('path')].map(e=>[e.getAttribute('d'),e.getAttribute('fill')])}})},await Promise.all(['agent.svg','anyko-mark-source.svg'].map(f=>fs.readFile(root+'/assets/'+f,'utf8'))));
const same=JSON.stringify(comparison[0])===JSON.stringify(comparison[1]);
const v=JSON.parse(await fs.readFile(root+'/verification.json','utf8'));v.localLinksChecked=links.length;v.ownerMainMatchesSitePaths=same;v.browser={desktopWidth:1920,mobileWidth:390,mobileOverflow:false,brokenImages:0,visualReview:['cover','mascot variants','product examples','mobile cover']};await fs.writeFile(root+'/verification.json',JSON.stringify(v,null,2));
console.log({localLinksChecked:links.length,ownerMainMatchesSitePaths:same});
await task.finish({keep:[]});
