const task=await taskSpace(2); const page=task.page('p1'); const fs=await import('node:fs/promises'); const crypto=await import('node:crypto');
const root='E:/WORK/anyko/docs/brand';
const files=['agent.png','agent.svg','agent-2.svg']; const evidence=[];
for(const name of files){const a=await fs.readFile('D:/Developer/Anyko/public/images/'+name),b=await fs.readFile(root+'/assets/'+name); if(!a.equals(b))throw Error('Source mismatch '+name); evidence.push({file:name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
const src=JSON.parse(await fs.readFile(root+'/assets/source-manifest.json','utf8')); src.ownerSupplied={directory:'D:/Developer/Anyko/public/images/',files:evidence}; await fs.writeFile(root+'/assets/source-manifest.json',JSON.stringify(src,null,2));
const lum=h=>{const c=h.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const pairs=[['button','#FFFFFF','#DB143C'],['body','#18181B','#FAF8F9'],['muted','#65616A','#FFFFFF'],['dark muted','#A1A1AA','#09090B'],['success','#166534','#ECFDF3'],['warning','#854D0E','#FFFBEB'],['error','#991B1B','#FEF2F2'],['info','#1E40AF','#EFF6FF']].map(([role,fg,bg])=>{const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return {role,foreground:fg,background:bg,ratio:Number(ratio.toFixed(2)),passesNormalText:ratio>=4.5}});
if(pairs.some(x=>!x.passesNormalText))throw Error('Contrast failed');
await fs.writeFile(root+'/verification.json',JSON.stringify({checked:'2026-11-04',sourceFiles:evidence,contrast:pairs,scope:'Token pairs only; not a full accessibility audit.'},null,2));
await page.goto('file:///E:/WORK/anyko/docs/brand/brandbook.html');
console.log(await page.evaluate(()=>({title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),sections:[...document.querySelectorAll('section')].length})));
await page.screenshot({path:'E:/WORK/anyko/work/brandbook-desktop.png'});
await page.evaluate(()=>document.querySelector('#mascot').scrollIntoView());
await page.screenshot({path:'E:/WORK/anyko/work/brandbook-mascots.png'});
console.log({sourceCopies:'identical',contrast:pairs});
