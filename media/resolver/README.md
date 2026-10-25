# Resolver walkthrough
**Version scope:** this recording predates observation-based follow-up. It shows
declared progress, not the newer observation history. The current interactive
demo includes that step. Existing audio/captions remain synchronized to the
recorded interface; they are not presented as a recording of the newer flow.



`walkthrough.en.mp4` is a recording of TAF's deployed English resolver demo,
with English synthetic narration (Microsoft `en-US-AriaNeural`) and separate
WebVTT subtitle tracks in English, Spanish, French and Simplified Chinese.

The saved example illustrates memory-budget checks, a shorter context, evidence
review, declared progress and a link to the field guide. It executes no model
inference and demonstrates no verified runtime repair. Screen playback is slowed
to 1/1.4 speed for readability; the intro and closing card are editorial graphics.
No result values were altered. Recorded on 2026-10-25 from the deployed app.

Duration: approximately 44 seconds. Video: H.264, 1000 × 1140, 25 fps.
Audio: English AAC. Captions: seven synchronized cues per language.
The image `poster.png` is the opening card. TAF loads the player on request,
does not autoplay, and uses the current UI language for the initial captions.

The Hugging Face discussion offers versions with captions rendered into the
video so users can choose a language even where the embedded player has no
subtitle-track selector. The TAF app uses one video plus four small VTT files.

## Regeneration

From the repository root (Playwright must already be installed):

```sh
python -m pip install --target tmp/hf-promo-deps imageio-ffmpeg==0.6.0 edge-tts==7.3.1
node scripts/record_resolver_video.mjs
python scripts/build_resolver_video.py --voice
python scripts/build_resolver_video.py --render
node tests/resolver_video_browser.mjs
```

The scripts use Windows Arial and Microsoft YaHei fonts. Raw recordings, voice
segments and captioned variants for HF stay in `tmp/hf-resolver-promo/`.
Review the cue timing against every new recording before publishing; the script
does not infer narration timing from an arbitrary changed demo. Voice generation
sends the public narration text to Microsoft's Edge speech service. Dependencies
are installed in the temporary directory, not into the project or global Python.
