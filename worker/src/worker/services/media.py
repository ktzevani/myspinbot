from __future__ import annotations

import asyncio
import json
import math
import os
import random
import struct
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from typing import Any, Dict, Optional, Tuple

# ---------------------------
# Lightweight media utilities
# ---------------------------


def _crc(chunk_type: bytes, data: bytes) -> bytes:
    """Compute CRC for PNG chunks."""
    import binascii

    return struct.pack(">I", binascii.crc32(chunk_type + data) & 0xFFFFFFFF)


def build_placeholder_png(prompt: str, width: int = 256, height: int = 256) -> bytes:
    """
    Generate a small valid PNG using only the stdlib. The colors are derived from the prompt hash
    so the output is deterministic per prompt.
    """
    # Derive pseudo colors from prompt hash
    seed = abs(hash(prompt)) % (2**32)
    random.seed(seed)
    r, g, b = (random.randint(40, 215) for _ in range(3))
    row = bytes([0, r, g, b] * width)  # filter type 0 + rgb triplet repeated
    raw = row * height
    compressor = zlib.compressobj()
    compressed = compressor.compress(raw) + compressor.flush()

    # PNG structure
    png = [b"\x89PNG\r\n\x1a\n"]
    # IHDR
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png.append(struct.pack(">I", len(ihdr_data)))
    png.append(b"IHDR")
    png.append(ihdr_data)
    png.append(_crc(b"IHDR", ihdr_data))
    # IDAT
    png.append(struct.pack(">I", len(compressed)))
    png.append(b"IDAT")
    png.append(compressed)
    png.append(_crc(b"IDAT", compressed))
    # IEND
    png.append(struct.pack(">I", 0))
    png.append(b"IEND")
    png.append(_crc(b"IEND", b""))
    return b"".join(png)


def synthesize_wave_speech(
    text: str, *, sample_rate: int = 22050, seconds_per_char: float = 0.08
) -> bytes:
    """
    Very small, dependency-free speech proxy: generates a sine-wave that changes frequency per character.
    This is only a stand-in when no TTS engine is configured.
    """
    import io
    import wave

    duration = max(1.0, len(text) * seconds_per_char)
    total_samples = int(sample_rate * duration)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        # Sweep frequency based on characters
        freqs = [200 + (ord(c) % 50) * 10 for c in text]
        freq_len = max(1, len(freqs))
        for i in range(total_samples):
            freq = freqs[i % freq_len]
            amplitude = 0.25
            value = int(amplitude * 32767 * math.sin(2 * math.pi * freq * (i / sample_rate)))
            wf.writeframes(struct.pack("<h", value))
    return buffer.getvalue()


# ---------------------------
# ComfyUI integration (best-effort)
# ---------------------------


class ComfyUIError(RuntimeError):
    """Raised when ComfyUI cannot be reached or returns an error."""


def _comfy_request(base_url: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = urllib.parse.urljoin(base_url, path)
    data = None
    if payload:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310 (local network call)
        raw = resp.read()
        return json.loads(raw)


def _fetch_comfy_file(base_url: str, filename: str, subfolder: str, filetype: str) -> bytes:
    query = urllib.parse.urlencode(
        {"filename": filename, "subfolder": subfolder or "", "type": filetype}
    )
    url = f"{base_url.rstrip('/')}/view?{query}"
    with urllib.request.urlopen(url, timeout=20) as resp:  # noqa: S310 (local network call)
        return resp.read()


def _build_basic_prompt(prompt: str, seed: Optional[int] = None) -> Dict[str, Any]:
    """
    Construct a minimal txt2img prompt graph that should work with a default SD1.5 checkpoint if present.
    This is intentionally simple; if the checkpoint isn't available ComfyUI will throw and we fall back.
    """
    sd_checkpoint = os.getenv("COMFYUI_CHECKPOINT", "v1-5-pruned-emaonly.safetensors")
    sam_seed = seed if seed is not None else int(time.time()) % (2**31)
    return {
        "prompt": {
            "3": {
                "class_type": "CheckpointLoaderSimple",
                "inputs": {"ckpt_name": sd_checkpoint},
            },
            "4": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": prompt, "clip": ["3", 1]},
            },
            "5": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": "", "clip": ["3", 1]},
            },
            "6": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
            "7": {
                "class_type": "KSampler",
                "inputs": {
                    "seed": sam_seed,
                    "steps": 15,
                    "cfg": 7,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["3", 0],
                    "positive": ["4", 0],
                    "negative": ["5", 0],
                    "latent_image": ["6", 0],
                },
            },
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 2]}},
            "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0]}},
        }
    }


def render_with_comfyui(prompt: str, base_url: str, *, timeout: float = 40.0) -> Tuple[bytes, Dict[str, Any]]:
    """
    Try to render a single image via ComfyUI. Returns (image_bytes, metadata).
    Raises ComfyUIError on failure; caller should fall back to placeholders.
    """
    start = time.time()
    graph = _build_basic_prompt(prompt)
    try:
        result = _comfy_request(base_url, "/prompt", graph)
    except (urllib.error.URLError, TimeoutError, ConnectionError, ValueError) as exc:
        raise ComfyUIError(f"failed to submit prompt: {exc}") from exc

    prompt_id = result.get("prompt_id")
    if not prompt_id:
        raise ComfyUIError("No prompt_id returned from ComfyUI")

    # Poll history
    while time.time() - start < timeout:
        time.sleep(1)
        try:
            history = _comfy_request(base_url, f"/history/{prompt_id}", {})
        except (urllib.error.URLError, TimeoutError, ConnectionError, ValueError):
            continue
        entry = history.get(prompt_id) or {}
        status = entry.get("status", {})
        if status.get("status_str") == "error":
            raise ComfyUIError(status.get("message", "ComfyUI error"))
        outputs = entry.get("outputs") or {}
        if "9" in outputs:
            images = outputs["9"].get("images") or []
            if not images:
                continue
            image_meta = images[0]
            try:
                img_bytes = _fetch_comfy_file(
                    base_url,
                    image_meta["filename"],
                    image_meta.get("subfolder", ""),
                    image_meta.get("type", "output"),
                )
            except Exception as exc:  # noqa: BLE001
                raise ComfyUIError(f"failed to download image: {exc}") from exc

            return img_bytes, {"prompt_id": prompt_id, "meta": image_meta}
    raise ComfyUIError("Timeout while waiting for ComfyUI render")


async def maybe_render_comfyui(prompt: str, base_url: str, *, timeout: float = 40.0) -> Tuple[bytes, Dict[str, Any]]:
    """
    Async wrapper around render_with_comfyui. Falls back to placeholder PNG on error.
    """
    try:
        return await asyncio.to_thread(render_with_comfyui, prompt, base_url, timeout=timeout)
    except Exception as exc:  # noqa: BLE001
        # fallback image
        return build_placeholder_png(prompt), {"error": str(exc), "source": "placeholder"}
