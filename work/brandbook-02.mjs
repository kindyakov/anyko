const task=await taskSpace(2); const page=task.page('p1');
const source=await page.evaluate(()=>{
 const header=document.querySelector('a[href="/"]');
 const svgs=[...document.querySelectorAll('svg[viewBox="0 0 578 394"]')];
 const mark=svgs[0], mascot=svgs.find(s=>s.getBoundingClientRect().width>100)||mark;
 const styles=getComputedStyle(document.documentElement);
 return {url:location.href,mark:mark.outerHTML,mascot:mascot.outerHTML,header:header.outerHTML,pathsIdentical:mark.innerHTML===mascot.innerHTML,colors:Object.fromEntries(['--color-accent-red','--color-accent-red-hover','--background','--color-card','--border','--color-foreground','--muted-foreground'].map(k=>[k,styles.getPropertyValue(k)])),font:getComputedStyle(header.querySelector('span')).fontFamily};
});
const fs=await import('node:fs/promises'); const root='E:/WORK/anyko/docs/brand'; await fs.mkdir(root+'/assets',{recursive:true});
await fs.writeFile(root+'/assets/anyko-mark-source.svg',source.mark);
await fs.writeFile(root+'/assets/anyko-mascot-source.svg',source.mascot);
await fs.writeFile(root+'/assets/source-header.html',source.header);
const inner=source.mark.slice(source.mark.indexOf('>')+1,source.mark.lastIndexOf('</svg>'));
for(const [name,color] of [['dark','#FAFAFA'],['light','#18181B']]) {
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="270" height="72" viewBox="0 0 270 72" role="img" aria-label="Anyko"><svg x="0" y="11.46" width="72" height="49.08" viewBox="0 0 578 394">${inner}</svg><text x="84" y="52" fill="${color}" font-family="system-ui, sans-serif" font-weight="800" font-size="44" letter-spacing="-1.5">Anyko</text></svg>`;
await fs.writeFile(root+`/assets/anyko-lockup-${name}.svg`,svg);
}
await fs.writeFile(root+'/assets/source-manifest.json',JSON.stringify({source:source.url,captured:'2026-11-04',colors:source.colors,font:source.font,markAndMascotPathsIdentical:source.pathsIdentical,notes:'Source SVG paths and fills preserved. Lockups assemble the original symbol with live system-ui text; text is not outlined. Dark/light refer to intended background.'},null,2));
console.log({saved:root,pathsIdentical:source.pathsIdentical,colors:source.colors});
await page.screenshot({path:root+'/assets/source-site.png'});
