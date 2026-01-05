# 🧠 Talking Avatar Pipeline Specification

### *(With Selectable Generation Variants)*

---

## 🎯 Goal

Generate talking avatar videos from text using:

* A cloned voice (from a reference audio sample)
* A static portrait or character image
* A selectable final animation style:

| Variant       | Output Style                                            | Use Case                                         |
| ------------- | ------------------------------------------------------- | ------------------------------------------------ |
| **Variant A** | Full-body walking / acting **(WAN S2V)**                | AI influencer, vlog-style agent, movement scenes |
| **Variant B** | Talking head / presenter **(InfiniteTalk / MultiTalk)** | Newscaster, narrator, assistant agent            |

A selector node allows switching styles **per render**, without changing the graph.

---

## 📦 Architecture Overview

```
──────────────────────────────────────────────
LAYER 1: Content & Voice Generation
──────────────────────────────────────────────
    Text → TTS-Audio-Suite → AUDIO (cloned voice)

──────────────────────────────────────────────
LAYER 2: Animation Variant Selection
──────────────────────────────────────────────
    A) WAN S2V full-body animation OR  
    B) InfiniteTalk presenter lip-sync

    Selected via ImpactPack → Switch (Any)

──────────────────────────────────────────────
LAYER 3: Output Assembly
──────────────────────────────────────────────
    Selected IMAGE stream + AUDIO → CreateVideo → Save MP4
```

Audio is generated **once** and reused across variants.

---

## 1️⃣ Required Inputs

| Input                      | Source                          | Notes                                 |
| -------------------------- | ------------------------------- | ------------------------------------- |
| **Script text**            | Provided externally             | Any language supported by TTS engine  |
| **Reference voice sample** | Short WAV/MP3 of target speaker | Clean speech only                     |
| **Portrait image**         | FluxMania / custom image        | Used in presenter variant             |
| **Full-body image**        | Generated or provided           | Recommended for walking/avatar motion |

---

## 2️⃣ Layer 1 — Voice Output via TTS-Audio-Suite

Purpose: Convert the user script to a synthetic voice matching the reference sample.

Pipeline:

```
Text → IndexTTSEngine → UnifiedTTSTextNode → AUDIO
```

Output:

```
AUDIO_STREAM
```

This audio will drive both animation paths.

---

## 3️⃣ Layer 2 — Animation Variants

Two independent image sequence generators use the same audio.

### ⭐ Variant A — WAN S2V (Walking / Acting)

Purpose: Generate gesture and movement while speaking.

Pipeline:

```
Full-Body Image + AUDIO_STREAM → WAN S2V → Frames
```

Result:

```
IMAGE_STREAM_A
```

Best for:

* Walking scenes
* Influencer-style content
* Action body language

---

### ⭐ Variant B — InfiniteTalk / MultiTalk (Presenter / Talking Head)

Purpose: Stable presenter with synchronized lip-sync and subtle motion.

Pipeline:

```
Portrait Image + AUDIO_STREAM → InfiniteTalk (or MultiTalk) → Frames
```

Result:

```
IMAGE_STREAM_B
```

Ideal for:

* News formats
* Product explainers
* Digital assistant avatars

---

### 🔀 Variant Selector

Uses **ImpactSwitch (Switch Any)**.

```
select = 0 → IMAGE_STREAM_A (WAN S2V)
select = 1 → IMAGE_STREAM_B (InfiniteTalk)
```

Output:

```
SELECTED_IMAGE_STREAM
```

---

## 4️⃣ Layer 3 — Final Video Assembly

Pipeline:

```
SELECTED_IMAGE_STREAM + AUDIO_STREAM → CreateVideo → SaveVideo (MP4)
```

Output example:

```
/video/output/avatar_<timestamp>.mp4
```

---

## ⚙️ Runtime Procedure

| Step | Action                                          |
| ---- | ----------------------------------------------- |
| 1    | Provide text, reference audio, and images       |
| 2    | TTS-Audio-Suite generates cloned-voice audio    |
| 3    | Both animation branches produce image sequences |
| 4    | Set `Variant_Select` to `0` or `1`              |
| 5    | CreateVideo muxes audio + visual                |
| 6    | Save final MP4                                  |

---

## Recommended Settings (16GB GPU)

| Setting           | Value         |
| ----------------- | ------------- |
| FPS               | 16–24         |
| Resolution        | 720×1280      |
| Max render length | ≤ 120 seconds |
| VRAM mode         | Enabled       |

---

## Future Extensions

| Feature                    | Benefit                    |
| -------------------------- | -------------------------- |
| RIFE interpolation         | Smooth motion              |
| Motion LoRAs               | Consistent gesture control |
| Automatic scene stitching  | Long-form episodes         |
| Real-time voice agent mode | Interactive assistant      |

---

### 🔥 Final Summary

> The system converts input text into a cloned voice using TTS-Audio-Suite, feeds that audio into two animation pipelines (WAN S2V for full-body movement or InfiniteTalk/MultiTalk for presenter-style talking), switches between them via a selector node, and combines the chosen animation with the audio into a final MP4 video.

---
