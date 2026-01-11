from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class TextToSpeechParams(BaseModel):
    model: str = Field(..., description="TextToSpeech model name")
    device: Literal["cuda", "cpu"] = Field(
        ..., description="Device to run the pipeline (PyTorch terminology)"
    )
    temperature: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Sampling temperature. Lower values (e.g., 0.1) produce more stable, deterministic prosody. Higher values (closer to 1.0) increase variation and expressiveness.",
    )
    speed: int = Field(
        ...,
        gt=0,
        description="Speech playback speed factor. Controls the pacing of the narration (higher values result in faster speech).",
    )
    target_rms: float = Field(
        ...,
        gt=0.0,
        description="Target Root Mean Square (RMS) amplitude for normalizing audio volume",
    )
    cross_fade_duration: float = Field(
        ...,
        ge=0.0,
        description="Duration (in seconds) of the cross-fade overlap between generated audio segments",
    )
    nfe_step: int = Field(
        ...,
        gt=0,
        description="Number of Function Evaluations (denoising steps) for the diffusion model (e.g., 32)",
    )
    cfg_strength: float = Field(
        ...,
        description="Classifier-Free Guidance strength. Controls how strictly the model adheres to the text/reference (typical value around 2.0)",
    )
    narrator_voice: str = Field(
        ...,
        description="File path to the reference audio file (wav/mp3) used to clone the voice",
    )
    seed: int = Field(
        ..., description="Random seed for reproducibility of the diffusion process"
    )
    ref_text: str = Field(
        ...,
        description="The transcript corresponding specifically to the narrator_voice audio clip",
    )
