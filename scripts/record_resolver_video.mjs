// Record the deployed app's own automatic demo, without changing its UI or results.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='tmp/hf-resolver-promo';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1000,height:900},
  deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1000,height:900}}});
const page=await context.newPage();const start=Date.now();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('https://karlexmarin-taf-agent.static.hf.space/?demo=resolver&lang=en',{waitUntil:'domcontentloaded'});
 await page.locator('#__taf_demo_banner').waitFor({timeout:30000});
 const trimStart=Math.max(0,(Date.now()-start)/1000-0.3);
 await page.screenshot({path:out+'/01-start.png'});
 await page.locator('#resolver-result dl').waitFor({timeout:30000});
 await page.screenshot({path:out+'/02-budget.png'});
 await page.locator('#resolver-progress-next').waitFor({timeout:30000});
 await page.screenshot({path:out+'/03-next-step.png'});
 await page.locator('#resolver-dialog #__taf_demo_explain').waitFor({timeout:40000});
 await page.screenshot({path:out+'/04-summary.png'});
 await page.waitForTimeout(4500);
 const end=(Date.now()-start)/1000;
 const video=page.video();await context.close();
 const recording=await video.path();
 writeFileSync(out+'/recording.json',JSON.stringify({recording,trimStart,duration:end-trimStart,errors},null,2));
 if(errors.length)throw new Error(JSON.stringify(errors));
 console.log(JSON.stringify({recording,trimStart,duration:end-trimStart,errors}));
}finally{await browser.close();}
