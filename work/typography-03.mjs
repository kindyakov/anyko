const fs=await import('node:fs/promises');const root='E:/WORK/anyko/docs/brand';
const v=JSON.parse(await fs.readFile(root+'/verification.json','utf8'));v.typography={version:'1.1',fonts:['Onest','Manrope','Unbounded'],allLoaded:true,cyrillicInMetadata:true,desktopWidth:1920,mobileWidth:390,mobileOverflow:false,localFontFiles:true};await fs.writeFile(root+'/verification.json',JSON.stringify(v,null,2));
const task=await taskSpace(4);const page=task.page('p1');
await page.cdp('Emulation.clearDeviceMetricsOverride',{});
await task.finish({keep:[]});
