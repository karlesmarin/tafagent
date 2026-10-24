import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {modeTopics,topics,metrics,words,tasks,validModel,readContext,guideLink,tafLink,resolverModes} from '../js/guide_bridge.js';
import {CASES} from '../js/resolver.js';
import {chapterTitles} from '../js/guide_chapters.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const modes=[...html.matchAll(/class="mode-btn[^"\n]*"[^>]*data-mode="([a-z]+)"/g)].map(m=>m[1]);
assert.equal(modes.length,31);
assert.deepEqual([...Object.keys(modeTopics)].sort(),modes.sort());
for(const [key,translations] of Object.entries(words)) {
  assert.equal(translations.length,4,key); assert.ok(translations.every(t=>typeof t==='string' && t.length>0),key);
}
for(const topic of Object.values(topics)) {
  for(const field of ['label','text']) assert.equal(topic[field].length,4);
  assert.ok(modeTopics[topic.next]);
  for(const chapter of topic.chapters) for(const lang of ['en','es']) assert.ok(chapterTitles[chapter][lang]);
}
for(const route of Object.values(modeTopics)) for(const topic of route) assert.ok(topics[topic]);
for(const [mode,topic,labels] of tasks) {assert.ok(modeTopics[mode]); assert.ok(topics[topic]); assert.equal(labels.length,4);}
for(const bad of ['',null,'../secret','https://evil.test/model','owner/model/path','x" onfocus="alert(1)','a/..','a\\b']) assert.equal(validModel(bad),false);
assert.equal(validModel('EleutherAI/pythia-70m'),true);
assert.equal(validModel('gpt2'),true);
const url=guideLink('gamma',0,{mode:'pvr',metric:'gamma_obs',value:0,model:'EleutherAI/pythia-70m',lang:'fr'});
assert.ok(url.includes('/en/chapters/15-ley-gamma.html'));
const decoded=readContext(new URL(url).search);
assert.equal(decoded.value,0); assert.equal(decoded.metric,'gamma_obs'); assert.equal(decoded.lang,'fr');
assert.equal(metrics[decoded.metric].kind,'measured');
const hf=readContext(new URL(guideLink('gamma',0,{mode:'pvr',app:'hf'})).search);
assert.equal(new URL(tafLink(hf)).hostname,'karlexmarin-taf-agent.static.hf.space');
const malicious=readContext('?mode=__proto__&topic=constructor&metric=toString&value=Infinity&model=javascript:alert(1)');
assert.equal(malicious.mode,null); assert.equal(malicious.metric,null); assert.equal(malicious.model,'');
assert.equal(readContext('?metric=gamma_obs&value=').metric,null);
assert.equal(new URL(tafLink({mode:'bad',model:'../private'})).search,'?mode=profile&lang=en');
assert.deepEqual(resolverModes,Object.fromEntries(Object.entries(CASES).map(([id,c])=>[id,c.mode])));
for(const [resolve,mode] of Object.entries(resolverModes))for(const app of ['hf','github'])for(const lang of ['en','es','fr','zh']){
 const ctx=readContext(new URL(guideLink(CASES[resolve].topic,0,{mode,resolve,app,lang,model:'Qwen/Qwen3-8B'})).search);
 const back=new URL(tafLink({...ctx,demo:true}));
 assert.equal(back.searchParams.get('resolve'),resolve);assert.equal(back.searchParams.get('lang'),lang);
 assert.equal(back.hostname,app==='hf'?'karlexmarin-taf-agent.static.hf.space':'karlesmarin.github.io');
 assert.equal(back.searchParams.has('demo'),false,'Returning must never start a demo');
 assert.equal(back.searchParams.has('model'),CASES[resolve].source!=='local');
}
for(const resolve of ['__proto__','constructor','https://evil.test','../memory','memory']){
 const ctx=readContext('?mode=pvr&resolve='+encodeURIComponent(resolve)+'&app=https://evil.test');
 assert.equal(ctx.resolve,null);assert.equal(new URL(tafLink(ctx)).hostname,'karlesmarin.github.io');
}
console.log('Guide bridge: 31 modes, bilingual chapters, 4 languages, safe links and measurement provenance PASS');
