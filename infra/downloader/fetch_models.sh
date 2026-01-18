#!/bin/sh
OLLAMA_FLAG="/ollama/.models_initialized"
if [ ! -f "$OLLAMA_FLAG" ]; then
    echo "Initializing model downloads…"
    echo "Pulling Mistral for Ollama..."
    curl http://ollama:11434/api/pull -d '{"name": "mistral:7b-instruct"}'
    curl http://ollama:11434/api/pull -d '{"name": "nomic-embed-text:latest"}'
    touch "$OLLAMA_FLAG"
else
    echo "Ollama models are there - skipping."
fi
COMFYUI_FLAG="/comfyui/.models_initialized"
if [ ! -f "$COMFYUI_FLAG" ]; then
    echo "Initializing model downloads…"
    echo "Downloading F5-TTS v1 Base Weights & Vocab..."
    # Download the main model weights
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/SWivid/F5-TTS/resolve/main/F5TTS_v1_Base/model_1250000.safetensors \
        --relative-path models/TTS/F5-TTS/F5TTS_v1_Base
    # Download the required vocabulary file
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/SWivid/F5-TTS/resolve/main/F5TTS_v1_Base/vocab.txt \
        --relative-path models/TTS/F5-TTS/F5TTS_v1_Base
    echo "Downloading Vocos vocoder..."
    comfy --skip-prompt --workspace /comfyui model download \
          --url https://huggingface.co/charactr/vocos-mel-24khz/resolve/main/pytorch_model.bin \
          --relative-path models/TTS/F5-TTS/vocos
    echo "Downloading Wan 2.1 InfiniTetalk Single (FP16)..."
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/InfiniteTalk/Wan2_1-InfiniTetalk-Single_fp16.safetensors \
        --relative-path models/diffusion_models/wanvideo/infinite_talk
    echo "Downloading Wan 2.1 VAE (BF16)..."
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2_1_VAE_bf16.safetensors \
        --relative-path models/vae/wanvideo
    echo "Downloading UMT5-XXL Text Encoder (BF16)..."
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/umt5-xxl-enc-bf16.safetensors \
        --relative-path models/text_encoders/umt5
    echo "Downloading Wan 2.1 CLIP Vision (H)..."
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors \
        --relative-path models/clip_vision/wanvideo
    echo "Downloading Wan 2.1 I2V 720p 14B (BF16)..."
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_i2v_720p_14B_bf16.safetensors \
        --relative-path models/diffusion_models/wanvideo
    echo "Downloading LightX2V I2V Distill Rank 64 (BF16)..."
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors \
        --relative-path models/loras/wanvideo
    echo "Downloading RealESRGAN x2 Upscaler..."
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/ai-forever/Real-ESRGAN/resolve/main/RealESRGAN_x2.pth \
        --relative-path models/upscale_models
    echo "Downloading CodeFormer (Face Restoration)..."
    comfy --skip-prompt --workspace /comfyui model download \
        --url https://huggingface.co/fofr/comfyui/resolve/main/facerestore_models/codeformer.pth \
        --relative-path models/facerestore_models
    touch "$COMFYUI_FLAG"
else
    echo "ComfyUI models are there - skipping."
fi
tail -f /dev/null