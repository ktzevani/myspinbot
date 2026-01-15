from __future__ import annotations
from typing import Literal, Optional
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


class InfiniteTalkParams(BaseModel):
    # Model Loading
    infinitetalk_model: str = Field(
        ...,
        description="Path to the InfiniteTalk model file used for multi-talk generation.",
    )
    vae_model: str = Field(
        ...,
        description="Path to the WanVideo VAE model for encoding and decoding video frames.",
    )
    t5_text_encoder_model: str = Field(
        ..., description="Path to the T5 text encoder model."
    )
    t5_precision: str = Field(
        ..., description="Numerical precision for the T5 text encoder."
    )
    wav2vec_model: str = Field(
        ...,
        description="Path or identifier for the Wav2Vec model used for audio embedding extraction.",
    )
    wav2vec_precision: str = Field(
        ..., description="Numerical precision for the Wav2Vec model."
    )
    wav2vec_load_device: str = Field(
        ..., description="Device to load the Wav2Vec model onto."
    )
    lora_model: str = Field(
        ..., description="Path to the LoRA adapter file for WanVideo."
    )
    lora_strength: float = Field(
        ..., description="Influence strength of the LoRA adapter."
    )
    clip_vision_model: str = Field(
        ...,
        description="Path to the CLIP Vision model for image encoding.",
    )
    wan_video_model: str = Field(
        ..., description="Path to the main WanVideo diffusion model."
    )
    wan_video_precision: str = Field(
        ..., description="Numerical precision for the main WanVideo model."
    )
    wan_video_quantization: str = Field(
        ..., description="Quantization method for the WanVideo model."
    )
    wan_video_load_device: str = Field(
        ..., description="Initial device placement for the WanVideo model."
    )
    # Memory & Performance
    blocks_to_swap: int = Field(
        ..., description="Number of transformer blocks to swap between GPU and CPU."
    )
    offload_img_emb: bool = Field(..., description="Offload image embeddings to CPU.")
    offload_txt_emb: bool = Field(..., description="Offload text embeddings to CPU.")
    compile_backend: str = Field(..., description="Torch compilation backend.")
    compile_fullgraph: bool = Field(
        ..., description="Whether to use fullgraph compilation."
    )
    compile_mode: str = Field(
        ..., description="Compilation mode (e.g., 'default', 'reduce-overhead')."
    )
    compile_dynamic: bool = Field(
        ..., description="Whether to use dynamic shapes in compilation."
    )
    compile_cache_size_limit: int = Field(
        ..., description="Limit for the dynamo cache size."
    )
    compile_transformer_blocks_only: bool = Field(
        ..., description="Only compile transformer blocks."
    )
    # Resolution & Resizing
    resolution_mode: str = Field(..., description="Resolution selection mode.")
    width: int = Field(..., description="Target width for the generated video.")
    height: int = Field(..., description="Target height for the generated video.")
    upscale_method: str = Field(..., description="Algorithm used for image upscaling.")
    keep_proportion: str = Field(
        ..., description="How to handle aspect ratio mismatches."
    )
    pad_color: str = Field(..., description="Padding color in RGB format.")
    crop_position: str = Field(..., description="Positioning for the crop operation.")
    divisible_by: int = Field(
        ..., description="Ensure dimensions are divisible by this value."
    )
    # Sampling & Generation
    fps: int = Field(..., description="Frames per second for the output video.")
    positive_prompt: str = Field(
        ..., description="Text describing the desired visual output."
    )
    negative_prompt: str = Field(
        ..., description="Text describing what to avoid in the output."
    )
    sampling_steps: int = Field(..., description="Number of denoising steps.")
    sampling_cfg: float = Field(..., description="Classifier-Free Guidance scale.")
    sampling_shift: float = Field(
        ..., description="Timestep shift for the flow-based sampler."
    )
    sampling_seed: int = Field(..., description="Seed for reproducibility.")
    sampling_force_offload: bool = Field(
        ..., description="Force model offloading during sampling."
    )
    sampling_scheduler: str = Field(..., description="Sampler scheduler algorithm.")
    riflex_freq_index: int = Field(..., description="Frequency index for RIFLEx.")
    frame_window_size: int = Field(
        ..., description="Size of the sliding window for long video generation."
    )
    motion_frame: int = Field(
        ..., description="Number of frames used for motion context."
    )
    infinitetalk_force_offload: bool = Field(
        ..., description="Force offload for InfiniteTalk nodes."
    )
    colormatch: str = Field(
        ..., description="Color matching algorithm between segments."
    )
    # Audio Processing
    audio_start_time: str = Field(
        ..., description="Start timestamp for audio cropping."
    )
    audio_end_time: str = Field(..., description="End timestamp for audio cropping.")
    normalize_loudness: bool = Field(
        ..., description="Whether to normalize audio volume."
    )
    audio_scale: float = Field(
        ..., description="Scaling factor for audio-driven motion."
    )
    audio_cfg_scale: float = Field(..., description="CFG scale for audio embeddings.")
    multi_audio_type: str = Field(
        ..., description="Method for combining multiple audio tracks."
    )
    # VAE Tiling
    encode_vae_tiling: bool = Field(..., description="Enable tiling for VAE encoding.")
    encode_tile_x: int = Field(..., description="Tile width for VAE encoding.")
    encode_tile_y: int = Field(..., description="Tile height for VAE encoding.")
    encode_tile_stride_x: int = Field(
        ..., description="Tile stride X for VAE encoding."
    )
    encode_tile_stride_y: int = Field(
        ..., description="Tile stride Y for VAE encoding."
    )
    decode_vae_tiling: bool = Field(..., description="Enable tiling for VAE decoding.")
    decode_tile_x: int = Field(..., description="Tile width for VAE decoding.")
    decode_tile_y: int = Field(..., description="Tile height for VAE decoding.")
    decode_tile_stride_x: int = Field(
        ..., description="Tile stride X for VAE decoding."
    )
    decode_tile_stride_y: int = Field(
        ..., description="Tile stride Y for VAE decoding."
    )
    # Output
    video_loop_count: int = Field(
        ..., description="Number of times the video should loop (0 for infinite)."
    )
    video_format: str = Field(
        ..., description="Container and codec format for the output."
    )
    video_pingpong: bool = Field(
        ..., description="Whether to apply a ping-pong effect to the video."
    )
    video_save_output: bool = Field(
        ..., description="Whether to save the final video to storage."
    )
    clip_vision_strength_1: float = Field(
        ..., description="Strength of the first CLIP Vision embedding."
    )
    clip_vision_strength_2: float = Field(
        ..., description="Strength of the second CLIP Vision embedding."
    )
    clip_vision_crop: str = Field(
        ..., description="Cropping strategy for CLIP Vision encoding."
    )
    clip_vision_combine_embeds: str = Field(
        ..., description="Method for combining CLIP Vision embeddings."
    )
    clip_vision_force_offload: bool = Field(
        ..., description="Force offload for CLIP Vision encoding."
    )


class AIUpscalerParams(BaseModel):
    model_name_0: str = Field(
        ...,
        description="Name of the upscale model to load (e.g., '4x_NMKD-Siax_200k.pth'). Used by the 'Load Upscale Model' node.",
    )
    model_name_1: str = Field(
        ...,
        description="Name of the face restoration model to load (e.g., 'codeformer.pth'). Used by the 'FaceRestoreModelLoader' node.",
    )
    batch_size: int = Field(
        ...,
        description="Number of frames to process in batch.",
    )
    force_rate: int = Field(
        ...,
        description="Force a specific frame rate for the input video (0 to use source rate). Used by the 'Load Video (Upload)' node.",
    )
    custom_width: int = Field(
        ...,
        description="Target width for resizing the input video (0 to keep original). Used by the 'Load Video (Upload)' node.",
    )
    custom_height: int = Field(
        ...,
        description="Target height for resizing the input video (0 to keep original). Used by the 'Load Video (Upload)' node.",
    )
    frame_load_cap: int = Field(
        ...,
        description="Maximum number of frames to load from the video (0 for all). Used by the 'Load Video (Upload)' node.",
    )
    skip_first_frames: int = Field(
        ...,
        description="Number of initial frames to skip when loading the video. Used by the 'Load Video (Upload)' node.",
    )
    select_every_nth: int = Field(
        ...,
        description="Load every Nth frame from the video source. Used by the 'Load Video (Upload)' node.",
    )
    facedetection: str = Field(
        ...,
        description="Face detection model to use for restoration (e.g., 'retinaface_resnet50'). Used by the 'FaceRestoreCFWithModel' node.",
    )
    codeformer_fidelity: float = Field(
        ...,
        description="Fidelity weight for CodeFormer face restoration. Typical range is 0.0 to 1.0. Used by the 'FaceRestoreCFWithModel' node.",
    )
