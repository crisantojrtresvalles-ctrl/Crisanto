# History video engine: cinematic upgrade (Stage 1)

Vertical 720x1280, 30 fps, 60 s episodes built with Remotion + React Three Fiber. 2D rigged characters stand inside a procedural 3D world.

## Pipeline

```
src/history/episodes/<ep>.ts   one Episode = data only (ships, islands, chars, camera keys, atmosphere, fx, transitions, narration, sfx, story)
        |
        |-- node scripts/qc.mjs            pre-render QC on the data (no GPU, ~0.3 s)
        |-- node scripts/qc-frames.mjs     pixel QC on real stills (needs Chromium + ffmpeg, ~3 s per still)
        |
        `-- node scripts/render-staged.mjs QC gate -> render in cached chunks -> stitch -> verify
```

The original commands still work unchanged (`npx remotion render ...`, `scripts/dev/stills.mjs`, the "Render History Video" workflow).

## What the QC checks (`src/history/qc/`)

| Check | What it verifies | How |
|---|---|---|
| script | hook starts <= 1 s and reads as a hook; a year/setting is spoken <= 15 s; pace 1.5-3.6 words/s; no overlap; story beats (hook, setting, conflict, twist, resolution) present, ordered, twist at 55-92 % of runtime; protagonist exists and appears in >= 3 scenes; scenes are >= 50 % narrated (no filler) | `ep.story`, narration, sampled camera |
| camera | every frame sampled: scene jumps found and checked against transitions (unmasked = **hard cut** error, violent whip-pan = warning); scene changes per 10 s; shot types (wide/medium/close-up/detail); first face on screen; FOV range and zoom speed; camera below water / inside terrain / inside a character | pure maths on the camera spline, wave and terrain functions |
| lighting | no weak light; sun on horizon; sudden unmasked light pops; **light changes when the story turns** (conflict/escalation/twist); warm and cool mix; low sun present | atmosphere keys vs. transitions and story beats |
| scene | all references resolve; duplicates; ship/character scale; characters inside hull footprint / on an island; density (elements in frame per second, sparse runs) | frustum projection of every entity |
| characters | valid colours, shared proportion ranges, distinct named cast, action flicker, expression range, **no blinking or bouncing while talking**, pose pops | `poseAt` sampled per frame |
| audio | narration audio fits its slot (needs `manifest.json`), every fx has a sound cue, every transition a whoosh, referenced files exist, cue pile-ups | manifest + sfx list |
| pixels (`qc-frames`) | washed-out, crushed, flat-contrast, colourless frames. Frames inside a scene-change wipe are skipped | ffmpeg `signalstats` on overlay-free stills (`plain` prop) |

Findings are `error` (blocks rendering), `warn` (flag) or `info`. Reports go to `out/qc/<episode>.txt|json`. Thresholds live in `src/history/qc/util.ts` (`DEFAULTS`); they are heuristics calibrated on episode 001 and the reference video (0.4 scene changes per 10 s, ~13 s shots, first face before ~8 s), so tune them.

`node scripts/qc-selftest.mjs` injects 13 known faults into a copy of the episode and asserts the QC catches each one. Run it after touching the QC.

## Staged rendering (`scripts/render-staged.mjs`)

- Runs the QC gate first. Errors stop the render (`--ignore-qc` overrides).
- Renders `--chunk-seconds` (default 15) per stage. Each chunk is cached in `out/chunks/` under a hash of source + audio + settings, so a re-run resumes and a small edit re-renders only the stages whose hash changed (in practice any `src/` edit changes all hashes; per-scene hashing is a Stage 2 item).
- Retries a failed chunk (`--retries`, relaunches Chromium), keeps finished chunks, exits non-zero listing what failed.
- Stitches without re-encoding video; audio is joined as exact PCM and AAC-encoded once (plain MP4 `-c copy` gave a variable frame rate and padded audio at the seams). Verifies size, fps, duration, audio.
- Free tooling only: Remotion, Chromium, ffmpeg. Use `--concurrency 1` on small machines.
- `.github/workflows/render-cinematic.yml` runs all of it on GitHub Actions (manual trigger, caches chunks).

## Writing a new episode

1. Copy `episodes/pirates.ts`; fill `story` first (logline, setting + year, protagonist, supporting, beats with times).
2. Write narration so a year/place is spoken in the first 15 s and the hook is a question or number.
3. Build ships/islands/chars, then camera keys. For every scene change use an object wipe in `transitions` plus a whoosh in `sfx`.
4. `npm run qc` until no errors; `node scripts/dev/stills.mjs <frames>` to look; `npm run qc:frames`; then render.
5. Register the episode in `scripts/qc.mjs` (`registry`) and in `HistoryVideo.tsx`.

## Status: what is and is not implemented

| Area | Status |
|---|---|
| Script structure validation | **Done** (story plan + checks). Not done: generating scripts from a topic. |
| Camera system | Existing: spline rig, tracking, orbit, whip, shake, zoom, motion blur. **Added:** verification (hard cuts, shot variety, zoom speed, safety). |
| Seamless transitions | Existing: object wipes. **Added:** a checker that finds unmasked jumps. Fixed 2 in episode 001. 2 violent whip-pans remain as warnings. |
| Lighting | Existing: sun, ambient, fog, storm, flashes. **Added:** continuity and story-alignment checks. **Not done:** night lighting / environment light sources (lanterns, fires), rim-light control. |
| Environment | Ocean, sky, ships, islands (palms, houses, fort), gulls only. **Not done:** streets, buildings, interiors, furniture, props, land terrain. This is the largest gap for non-naval stories. |
| Characters | Existing: 2.5D rig, looks, poses, expressions. **Fixed:** blinking while talking. **Not done:** a shared character library file; real lip-sync (mouth is a sine wave, not the audio). |
| QC | **Done** (data + pixel + self-test). Not done: transition-continuity pixel diff, per-surface texture analysis. |
| Rendering | **Done:** staged, cached, retrying, verified. Verified: chunk stitch, seam audio, cache hit. **Not verified:** Chromium-crash recovery under test; the new GitHub workflow has not run on Actions. |
