import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_VIDEO_URL||'http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true});
try{
 for(const lang of ['en','es','fr','zh']){
  const context=await browser.newContext({viewport:{width:lang==='es'?390:1100,height:900}});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/media/resolver/'))requests.push(r.url());});
  if(!process.env.TAF_VIDEO_URL)await context.route(base+'**',async r=>{
   const path=resolve(root,decodeURIComponent(new URL(r.request().url()).pathname.slice(1))||'index.html');
   if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
   if(path.endsWith('.vtt'))return r.fulfill({contentType:'text/vtt',body:readFileSync(path)});
   if(path.endsWith('.mp4')){
    const bytes=readFileSync(path),range=r.request().headers()['range'];
    if(range){const match=/bytes=(\d+)-(\d*)/.exec(range);const start=Number(match[1]),end=match[2]?Number(match[2]):bytes.length-1;
     return r.fulfill({status:206,contentType:'video/mp4',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)});}
    return r.fulfill({contentType:'video/mp4',headers:{'Accept-Ranges':'bytes'},body:bytes});
   }
   await r.fulfill({path});
  });
  await context.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
  await page.goto(base+'?resolve=choose&lang='+lang);
  await page.locator('#resolver-dialog[open]').waitFor();
  assert.equal(await page.locator('#resolver-video-player').count(),0);
  assert.deepEqual(requests,[],'No media downloaded on initial load');
  assert.equal(await page.locator('#resolver-video > summary').innerText(),RESOLVER_TRANSLATIONS[lang]['resolver.video_title']);
  await page.locator('#resolver-video > summary').click();
  const player=page.locator('#resolver-video-player');await player.waitFor();
  assert.equal(await player.getAttribute('preload'),'none');
  assert.equal(await player.getAttribute('autoplay'),null);
  assert.equal(await page.locator('#resolver-video-captions').inputValue(),lang);
  assert.equal(await player.locator('track').count(),4);
  assert.equal(requests.some(u=>u.endsWith('.mp4')),false,'Opening does not download the movie before play');
  await player.evaluate(v=>v.play());
  await page.waitForFunction(()=>document.querySelector('#resolver-video-player').currentTime>0.5);
  const info=await player.evaluate(v=>({w:v.videoWidth,h:v.videoHeight,duration:v.duration,paused:v.paused}));
  assert.deepEqual([info.w,info.h],[1000,1140]);assert.ok(info.duration>43&&info.duration<46);
  await page.waitForFunction(l=>[...document.querySelector('video').textTracks].some(t=>t.language===l&&t.mode==='showing'&&t.cues?.length===7),lang);
  await page.locator('#resolver-video-captions').selectOption('zh');
  await page.waitForFunction(()=>[...document.querySelector('video').textTracks].some(t=>t.language==='zh'&&t.mode==='showing'&&t.cues?.length===7));
  await page.locator('#resolver-video-captions').selectOption('off');
  assert.ok(await player.evaluate(v=>[...v.textTracks].every(t=>t.mode==='disabled')));
  await page.locator('#resolver-video-captions').selectOption(lang);
  await player.evaluate(v=>{v.currentTime=18;v.pause();});
  await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&v.readyState>=2&&[...v.textTracks].some(t=>t.mode==='showing'&&t.activeCues?.length);}).catch(async e=>{console.log(await player.evaluate(v=>({time:v.currentTime,seeking:v.seeking,ready:v.readyState,error:v.error?.message,tracks:[...v.textTracks].map(t=>({lang:t.language,mode:t.mode,cues:t.cues?.length,active:t.activeCues?.length}))})));throw e;});
  await player.scrollIntoViewIfNeeded();
  mkdirSync('tmp/hf-resolver-promo',{recursive:true});
  await page.screenshot({path:`tmp/hf-resolver-promo/player-${lang}.png`});
  await player.evaluate(v=>v.play());
  await page.locator('#resolver-video > summary').click();
  await page.waitForFunction(()=>document.querySelector('video').paused);
  await page.locator('#resolver-video > summary').click();
  assert.equal(await player.evaluate(v=>v.paused),true);
  await player.evaluate(v=>v.play());await page.locator('#resolver-close').click();
  await page.waitForFunction(()=>document.querySelector('video').paused);
  assert.deepEqual(errors,[]);
  await context.close();console.log('Video PASS: '+lang+' — lazy loading, actual H.264 playback, 4 caption tracks, selection/off, pause on close.');
 }
}finally{await browser.close();}
