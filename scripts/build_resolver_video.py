"""Assemble a real recorded walkthrough with English speech and four caption tracks."""
from pathlib import Path
import sys, json, subprocess, asyncio, wave, textwrap, re
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tmp/hf-promo-deps'))
import imageio_ffmpeg, edge_tts
from PIL import Image, ImageDraw, ImageFont
FF=imageio_ffmpeg.get_ffmpeg_exe()
WORK=ROOT/'tmp/hf-resolver-promo'
OUT=ROOT/'media/resolver'
OUT.mkdir(parents=True,exist_ok=True)
META=json.loads((WORK/'recording.json').read_text())
MAIN=META['duration']*1.4
TOTAL=MAIN+8
CUES=[
 (0.25,3.85,["A clear next step for your LLM problem.","Un siguiente paso claro para tu problema con un LLM.","Une prochaine étape claire pour votre problème de LLM.","遇到大语言模型问题？找到明确的下一步。"]),
 (4.2,9.8,["Out of memory during generation? Start with the symptom.","¿Falta memoria al generar? Empieza por el síntoma.","Mémoire insuffisante pendant la génération ? Partez du symptôme.","生成时内存不足？从症状开始。"]),
 (10,15.5,["Load a saved example and explore a shorter context.","Carga un ejemplo guardado y prueba un contexto más corto.","Chargez un exemple enregistré et explorez un contexte plus court.","加载已保存的示例，尝试缩短上下文。"]),
 (16,22,["Review the estimate, its assumptions, and what remains unverified.","Revisa la estimación, sus supuestos y lo que falta verificar.","Examinez l’estimation, ses hypothèses et ce qui reste à vérifier.","检查估算、相关假设，以及尚未验证的内容。"]),
 (23,31,["Track your checks. If one is blocked, TAF suggests the next step.","Sigue tus comprobaciones. Si alguna se bloquea, TAF indica el siguiente paso.","Suivez vos vérifications. Si l’une est bloquée, TAF propose la prochaine étape.","跟踪检查进度。某项检查受阻时，TAF 会建议下一步。"]),
 (32,39.8,["Follow the guide to understand why. Then try your own case.","Consulta la guía para entender el porqué. Después prueba tu propio caso.","Consultez le guide pour comprendre pourquoi. Puis essayez votre propre cas.","阅读指南，理解原因。然后尝试分析你自己的问题。"]),
 (MAIN+4.2,TOTAL-0.1,["Illustrative demo. No model inference or verified repair.","Demo ilustrativa. Sin inferencia del modelo ni reparación verificada.","Démonstration illustrative. Aucune inférence ni réparation vérifiée.","仅为演示示例，未运行模型推理，也未验证修复。"]),
]
LANGS=['en','es','fr','zh']

def run(args):
    p=subprocess.run([FF,'-hide_banner','-loglevel','error','-y',*map(str,args)],capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-5000:])

def font(size,bold=False,zh=False):
    return ImageFont.truetype('C:/Windows/Fonts/'+('msyh.ttc' if zh else 'arialbd.ttf' if bold else 'arial.ttf'),size)

def center(draw,text,y,size=35,color='#e6edf3',bold=False,zh=False):
    f=font(size,bold,zh); width=draw.textlength(text,font=f)
    assert width<950,(text,width)
    draw.text(((1000-width)/2,y),text,font=f,fill=color)

def card(name,ending=False):
    im=Image.new('RGB',(1000,1140),'#0d1117');d=ImageDraw.Draw(im)
    d.rounded_rectangle((65,100,935,1010),radius=32,fill='#111b2b',outline='#30445d',width=2)
    d.rounded_rectangle((105,145,330,196),radius=25,fill='#173252')
    d.text((130,155),'TAF AGENT',font=font(25,True),fill='#7dc5ff')
    center(d,'Know what to check next.' if ending else 'LLM problem?',345,48,bold=True)
    center(d,'Try your own case.' if ending else 'Find your next check.',415,48,bold=True)
    center(d,'Guided checks + explanations + the field guide',515,27,color='#b6c5d8')
    d.rounded_rectangle((185,610,815,695),radius=18,fill='#2275e4')
    center(d,'Open “Solve my problem”' if ending else 'Watch the guided walkthrough',634,29,bold=True)
    center(d,'huggingface.co/spaces/karlexmarin/taf-agent',750,25,color='#86bfff')
    center(d,'English audio · EN / ES / FR / 中文 captions',810,24,zh=True)
    center(d,'Illustrative example · no model inference',890,24,color='#aab7c8')
    im.save(WORK/name)

def overlays():
    im=Image.new('RGBA',(1000,1140),(0,0,0,0));d=ImageDraw.Draw(im)
    d.rectangle((0,0,1000,80),fill='#0d1117')
    d.text((28,24),'TAF Agent',font=font(27,True),fill='#7dc5ff')
    d.text((540,30),'GUIDED TROUBLESHOOTING',font=font(20,True),fill='#c5d5e8')
    d.rectangle((0,980,1000,1140),fill='#0d1117')
    center(d,'Saved example · not a live GPU measurement',1104,20,color='#9fadc0')
    im.save(WORK/'frame.png')

def stamp(seconds,comma=False):
    ms=round(seconds*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02}{"," if comma else "."}{ms:03}'

def caption_lines(text,lang):
    if lang=='zh':
        return '\n'.join(text[i:i+27] for i in range(0,len(text),27))
    return '\n'.join(textwrap.wrap(text,width=58))

def captions():
    for idx,lang in enumerate(LANGS):
        vtt=['WEBVTT',''];srt=[]
        for n,(start,end,texts) in enumerate(CUES,1):
            text=caption_lines(texts[idx],lang)
            assert len(text.splitlines())<=2
            vtt += [f'{stamp(start)} --> {stamp(end)} position:50% size:92% align:center',text,'']
            srt += [str(n),f'{stamp(start,True)} --> {stamp(end,True)}',text,'']
        (OUT/f'captions.{lang}.vtt').write_text('\n'.join(vtt),encoding='utf-8')
        (WORK/f'captions.{lang}.srt').write_text('\n'.join(srt),encoding='utf-8')
    (WORK/'cues.json').write_text(json.dumps(CUES,ensure_ascii=False,indent=2),encoding='utf-8')

async def voice():
    for i,(start,end,texts) in enumerate(CUES):
        path=WORK/f'voice-{i}.mp3'
        if path.exists():continue
        speech=texts[0].replace('LLM','L L M').replace('TAF','Taf')
        await edge_tts.Communicate(speech,'en-US-AriaNeural',rate='+0%').save(str(path))
        print(f'English narration segment {i+1}/{len(CUES)} generated.',flush=True)

def render():
    card('intro.png');card('outro.png',True);overlays();captions()
    for i,(start,end,_) in enumerate(CUES):
        wav=WORK/f'voice-{i}.wav';run(['-i',WORK/f'voice-{i}.mp3','-ar','48000','-ac','1',wav])
        with wave.open(str(wav)) as f:duration=f.getnframes()/f.getframerate()
        window=end-start
        if duration>window:
            run(['-i',wav,'-af',f'atempo={duration/window:.5f}','-ar','48000','-ac','1',WORK/f'voice-{i}-fit.wav'])
        else:
            (WORK/f'voice-{i}-fit.wav').write_bytes(wav.read_bytes())
    audio_args=[];audio_filters=[]
    for i,(start,_,_) in enumerate(CUES):
        audio_args+=['-i',WORK/f'voice-{i}-fit.wav']
        audio_filters.append(f'[{i}:a]adelay={round(start*1000)}:all=1[a{i}]')
    audio_filters.append(''.join(f'[a{i}]' for i in range(len(CUES)))+f'amix=inputs={len(CUES)}:normalize=0,apad,atrim=duration={TOTAL},alimiter=limit=0.95[a]')
    run([*audio_args,'-filter_complex',';'.join(audio_filters),'-map','[a]','-ar','48000',WORK/'narration.wav'])
    filters=(f'[0:v]trim=start={META["trimStart"]}:duration={META["duration"]},setpts=1.4*(PTS-STARTPTS),fps=25,pad=1000:1140:0:80:color=0x0d1117[v];'
             '[v][1:v]overlay=0:0:shortest=1[main];'
             '[2:v]trim=duration=4,setpts=PTS-STARTPTS,fps=25,format=yuv420p[intro];'
             '[3:v]trim=duration=4,setpts=PTS-STARTPTS,fps=25,format=yuv420p[outro];'
             '[intro][main][outro]concat=n=3:v=1:a=0[video]')
    run(['-i',META['recording'],'-loop','1','-i',WORK/'frame.png','-loop','1','-i',WORK/'intro.png',
         '-loop','1','-i',WORK/'outro.png','-i',WORK/'narration.wav','-filter_complex',filters,
         '-map','[video]','-map','4:a','-t',TOTAL,'-c:v','libx264','-preset','medium','-crf','22',
         '-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',OUT/'walkthrough.en.mp4'])
    (OUT/'poster.png').write_bytes((WORK/'intro.png').read_bytes())
    print('Master with English narration rendered.',flush=True)
    burn()

def burn():
    # HF discussion players do not promise a caption selector: provide four captioned variants.
    for lang in LANGS:
        name='Microsoft YaHei' if lang=='zh' else 'Arial'
        sub=f"subtitles=captions.{lang}.srt:force_style='FontName={name},FontSize=8,PrimaryColour=&H00FFFFFF,OutlineColour=&H0017110D,BorderStyle=1,Outline=0.7,Alignment=2,MarginV=18'"
        # Relative subtitle filename avoids Windows drive-colon filter escaping.
        p=subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-i',str(OUT/'walkthrough.en.mp4'),
                          '-vf',sub,'-c:v','libx264','-preset','medium','-crf','22','-c:a','copy',
                          '-movflags','+faststart',f'walkthrough.sub-{lang}.mp4'],cwd=WORK,capture_output=True,text=True)
        if p.returncode:raise RuntimeError(p.stderr[-4000:])
        print(f'Captioned video rendered: {lang}',flush=True)
    (WORK/'render.json').write_text(json.dumps({'duration':TOTAL,'width':1000,'height':1140,
        'audio_language':'en','voice':'en-US-AriaNeural','captions':LANGS,'playback_slowdown':1.4},indent=2))

if __name__=='__main__':
    if '--voice' in sys.argv:asyncio.run(voice())
    if '--render' in sys.argv:render()
    if '--burn' in sys.argv:burn()
    if '--captions' in sys.argv:captions()
