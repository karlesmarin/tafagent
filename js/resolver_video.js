import {t,getLang} from './i18n.js';
const LANGUAGES={en:'English',es:'Español',fr:'Français',zh:'中文'};
const base=new URL('../media/resolver/',import.meta.url);
const tr=key=>t('resolver.'+`video_${key}`);

// Create media only after explicit disclosure. Neither autoplay nor eager downloads.
export function createResolverVideo(){
 const element=document.createElement('details');element.id='resolver-video';
 const summary=document.createElement('summary');element.append(summary);
 let video=null,note=null,label=null,select=null,download=null,off=null,tracksReady=false;
 function setCaptions(lang){
  if(!video)return;
  for(const track of video.textTracks)track.mode=track.language===lang?'showing':'disabled';
 }
 function pause(){if(video)video.pause();}
 function refresh(){
  summary.textContent=tr('title');
  if(!video)return;
  note.textContent=tr('note');label.textContent=tr('captions');off.textContent=tr('off');
  download.textContent=tr('download');video.setAttribute('aria-label',tr('title'));
  select.value=Object.hasOwn(LANGUAGES,getLang())?getLang():'en';setCaptions(select.value);
 }
 element.addEventListener('toggle',()=>{
  if(!element.open){pause();return;}
  if(video)return;
  note=document.createElement('p');
  label=document.createElement('label');label.htmlFor='resolver-video-captions';
  select=document.createElement('select');select.id=label.htmlFor;
  for(const [lang,name] of Object.entries(LANGUAGES))select.append(new Option(name,lang));
  off=new Option('','off');select.append(off);
  video=document.createElement('video');video.id='resolver-video-player';video.controls=true;
  video.preload='none';video.playsInline=true;video.poster=new URL('poster.png',base).href;
  video.src=new URL('walkthrough.en.mp4',base).href;
  for(const [lang,name] of Object.entries(LANGUAGES)){
   const track=document.createElement('track');track.kind='subtitles';track.srclang=lang;track.label=name;
   track.default=lang===getLang();track.src=new URL(`captions.${lang}.vtt`,base).href;video.append(track);
  }
  select.addEventListener('change',()=>setCaptions(select.value));
  video.addEventListener('loadedmetadata',()=>setCaptions(select.value));
  video.addEventListener('loadeddata',()=>{setCaptions(select.value);tracksReady=true;});
  video.textTracks.addEventListener('change',()=>{
   if(!tracksReady)return;
   const showing=[...video.textTracks].find(track=>track.mode==='showing');
   select.value=showing?.language||'off';
  });
  download=document.createElement('a');download.href=video.src;download.target='_blank';download.rel='noopener';
  const link=document.createElement('p');link.append(download);
  element.append(note,label,select,video,link);refresh();
 });
 refresh();return {element,refresh,pause,collapse(){pause();element.open=false;}};
}
