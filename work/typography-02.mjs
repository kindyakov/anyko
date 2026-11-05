const task=await taskSpace(4);const page=task.page('p1');
await page.evaluate(()=>document.querySelector('.display-font').scrollIntoView({behavior:'instant'}));
await page.screenshot({path:'E:/WORK/anyko/work/typography-accent.png'});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await page.evaluate(()=>document.querySelector('.display-font').scrollIntoView({behavior:'instant'}));
await page.screenshot({path:'E:/WORK/anyko/work/typography-mobile.png'});
console.log(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),overflow:[...document.querySelectorAll('section,.font-sample,.card')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>e.id||e.className)})));
