# Trial lesson audio

Pre-rendered tutor-voice clips for the bundled onboarding topic packs
(`components/onboarding/topic-packs/`). Laid out as:

```
<language>/<topic>/{w1,w2,w3,sentence}.mp3
```

**Empty on purpose right now.** Nothing here is hand-placed — every file is
produced by `scripts/render-trial-audio.mjs`, which calls the deployed `tts`
edge function so the trial uses the same voice as lesson one, then regenerates
`components/onboarding/topic-packs/audio-manifest.ts` from whatever it finds.

A missing clip is not a broken pack: `resolveTrialAudio` returns null, and the
pack degrades from a listening exercise to a text-only multiple choice of the
same word. That fallback is the reason the manifest can be committed empty.

Budget: 9 languages × 5 topics × 4 clips = 180 files, ~20 KB each, so roughly
3.5 MB added to the binary once it is all rendered. Run the script with
`--dry-run` first; it prints the estimate and lists the work without spending
anything.
