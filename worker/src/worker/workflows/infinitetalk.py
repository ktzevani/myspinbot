import os
import uuid
from io import BytesIO
import numpy as np
from PIL import Image
from minio import Minio
from ..models.worker.workflows_schema import InfiniteTalkParams

_DEPS = dict()


def _ensure_initialized():
    global _DEPS

    if len(_DEPS) > 0:
        return

    import importlib
    from . import initialize_comfy_environment, load_comfy_module

    nodes_dir = initialize_comfy_environment()

    wan_video_module = importlib.import_module("custom_nodes.ComfyUI-WanVideoWrapper")
    video_helpers_module = importlib.import_module(
        "custom_nodes.comfyui-videohelpersuite"
    )
    audio_separation_module = importlib.import_module(
        "custom_nodes.audio-separation-nodes-comfyui"
    )
    audio_comfy_mtb_module = importlib.import_module("custom_nodes.comfy-mtb")
    comfyui_kjnodes_module = importlib.import_module("custom_nodes.comfyui-kjnodes")
    nodes_audio_module = load_comfy_module(
        os.path.join(nodes_dir, "comfy_extras", "nodes_audio.py")
    )
    nodes_module = load_comfy_module(os.path.join(nodes_dir, "nodes.py"))

    _DEPS.update({"LoadAudio": nodes_audio_module.LoadAudio})
    _DEPS.update({"LoadImage": nodes_module.LoadImage})
    _DEPS.update({"CLIPVisionLoader": nodes_module.CLIPVisionLoader})
    _DEPS.update(audio_comfy_mtb_module.NODE_CLASS_MAPPINGS)
    _DEPS.update(audio_separation_module.NODE_CLASS_MAPPINGS)
    _DEPS.update(comfyui_kjnodes_module.NODE_CLASS_MAPPINGS)
    _DEPS.update(video_helpers_module.NODE_CLASS_MAPPINGS)
    _DEPS.update(wan_video_module.NODE_CLASS_MAPPINGS)

    if len(_DEPS) == 0:
        raise RuntimeError(f"{__name__}: Failed to import dependencies.")


class InfiniteTalk:
    def __init__(self, **kwargs):
        _ensure_initialized()
        self.params = InfiniteTalkParams(**kwargs)
        self.audio_crop = _DEPS["AudioCrop"]()
        self.audio_separation = _DEPS["AudioSeparation"]()
        self.audio_duration_mtb = _DEPS["Audio Duration (mtb)"]()
        self.clip_vision_loader = _DEPS["CLIPVisionLoader"]()
        self.download_and_load_wav2_vec_model = _DEPS["DownloadAndLoadWav2VecModel"]()
        self.image_resize_kj_v2 = _DEPS["ImageResizeKJv2"]()
        self.load_audio = _DEPS["LoadAudio"]()
        self.load_image = _DEPS["LoadImage"]()
        self.load_wan_video_t5_text_encoder = _DEPS["LoadWanVideoT5TextEncoder"]()
        self.multi_talk_model_loader = _DEPS["MultiTalkModelLoader"]()
        self.multi_talk_wav2_vec_embeds = _DEPS["MultiTalkWav2VecEmbeds"]()
        self.vhs_video_combine = _DEPS["VHS_VideoCombine"]()
        self.wan_video_block_swap = _DEPS["WanVideoBlockSwap"]()
        self.wan_video_clip_vision_encode = _DEPS["WanVideoClipVisionEncode"]()
        self.wan_video_decode = _DEPS["WanVideoDecode"]()
        self.wan_video_encode = _DEPS["WanVideoEncode"]()
        self.wan_video_image_to_video_multi_talk = _DEPS[
            "WanVideoImageToVideoMultiTalk"
        ]()
        self.wan_video_lora_select = _DEPS["WanVideoLoraSelect"]()
        self.wan_video_model_loader = _DEPS["WanVideoModelLoader"]()
        self.wan_video_sampler = _DEPS["WanVideoSampler"]()
        self.wan_video_text_encode = _DEPS["WanVideoTextEncode"]()
        self.wan_video_torch_compile_settings = _DEPS["WanVideoTorchCompileSettings"]()
        self.wan_video_vae_loader = _DEPS["WanVideoVAELoader"]()

    def estimate_progress_steps(self, audioStorageRef: str, fps: int, window_size: int):
        from ..config import get_config
        import torchaudio
        import math

        worker_config = get_config()
        client = Minio(
            worker_config.storage.url.replace("http://", "").replace("https://", ""),
            worker_config.storage.username,
            worker_config.storage.password,
            secure=worker_config.storage.url.startswith("https://"),
        )

        a_bucket, a_key = audioStorageRef.split("/", 1)
        a_response = client.get_object(a_bucket, a_key)
        try:
            waveform, sample_rate = torchaudio.load(BytesIO(a_response.read()))
        finally:
            a_response.close()
            a_response.release_conn()

        audio_duration_sec = math.ceil(waveform.shape[1] / sample_rate)
        if audio_duration_sec > 60:
            audio_duration_sec = 60
        steps = 8 + math.ceil(audio_duration_sec * fps / window_size) * 23

        return steps

    def run(self, imageStorageRef: str, audioStorageRef: str):
        from ..config import get_config
        from ..services.tasks import upload_bytes
        import folder_paths
        import torch
        import torchaudio

        worker_config = get_config()
        client = Minio(
            worker_config.storage.url.replace("http://", "").replace("https://", ""),
            worker_config.storage.username,
            worker_config.storage.password,
            secure=worker_config.storage.url.startswith("https://"),
        )

        with torch.inference_mode():
            multitalkmodelloader = self.multi_talk_model_loader.loadmodel(
                model=self.params.infinitetalk_model
            )

            # Load Audio from MinIO
            a_bucket, a_key = audioStorageRef.split("/", 1)
            a_response = client.get_object(a_bucket, a_key)
            try:
                waveform, sample_rate = torchaudio.load(BytesIO(a_response.read()))
                loadaudio = (
                    {
                        "waveform": waveform.unsqueeze(0),
                        "sample_rate": sample_rate,
                    },
                )
            finally:
                a_response.close()
                a_response.release_conn()

            wanvideovaeloader = self.wan_video_vae_loader.loadmodel(
                model_name=self.params.vae_model,
                precision="bf16",
                use_cpu_cache=False,
            )

            wanvideoblockswap = self.wan_video_block_swap.setargs(
                blocks_to_swap=self.params.blocks_to_swap,
                offload_img_emb=self.params.offload_img_emb,
                offload_txt_emb=self.params.offload_txt_emb,
                use_non_blocking=True,
                vace_blocks_to_swap=0,
                prefetch_blocks=1,
                block_swap_debug=False,
            )

            loadwanvideot5textencoder = self.load_wan_video_t5_text_encoder.loadmodel(
                model_name=self.params.t5_text_encoder_model,
                precision=self.params.t5_precision,
                load_device="offload_device",
                quantization="disabled",
            )

            downloadandloadwav2vecmodel = (
                self.download_and_load_wav2_vec_model.loadmodel(
                    model=self.params.wav2vec_model,
                    base_precision=self.params.wav2vec_precision,
                    load_device=self.params.wav2vec_load_device,
                )
            )

            wanvideoloraselect = self.wan_video_lora_select.getlorapath(
                lora=self.params.lora_model,
                strength=self.params.lora_strength,
                low_mem_load=False,
                merge_loras=True,
                unique_id=1658967506290230382,
            )

            clipvisionloader = self.clip_vision_loader.load_clip(
                clip_name=self.params.clip_vision_model
            )

            # Load Image from MinIO
            i_bucket, i_key = imageStorageRef.split("/", 1)
            i_response = client.get_object(i_bucket, i_key)
            try:
                img = Image.open(BytesIO(i_response.read())).convert("RGB")
                img_np = np.array(img).astype(np.float32) / 255.0
                image_tensor = torch.from_numpy(img_np)[None,]
                loadimage = (image_tensor,)
            finally:
                i_response.close()
                i_response.release_conn()

            wanvideotorchcompilesettings = self.wan_video_torch_compile_settings.set_args(
                backend=self.params.compile_backend,
                fullgraph=self.params.compile_fullgraph,
                mode=self.params.compile_mode,
                dynamic=self.params.compile_dynamic,
                dynamo_cache_size_limit=self.params.compile_cache_size_limit,
                compile_transformer_blocks_only=self.params.compile_transformer_blocks_only,
                dynamo_recompile_limit=128,
                force_parameter_static_shapes=False,
                allow_unmerged_lora_compile=False,
            )

            imageresizekjv2 = self.image_resize_kj_v2.resize(
                width=self.params.width,
                height=self.params.height,
                upscale_method=self.params.upscale_method,
                keep_proportion=self.params.keep_proportion,
                pad_color=self.params.pad_color,
                crop_position=self.params.crop_position,
                divisible_by=self.params.divisible_by,
                device="cpu",
                image=loadimage[0],
                unique_id=11178357808504788049,
            )

            wanvideoencode = self.wan_video_encode.encode(
                enable_vae_tiling=self.params.encode_vae_tiling,
                tile_x=self.params.encode_tile_x,
                tile_y=self.params.encode_tile_y,
                tile_stride_x=self.params.encode_tile_stride_x,
                tile_stride_y=self.params.encode_tile_stride_y,
                noise_aug_strength=0.025,
                latent_strength=0.925,
                vae=wanvideovaeloader[0],
                image=imageresizekjv2[0],
            )

            wanvideomodelloader = self.wan_video_model_loader.loadmodel(
                model=self.params.wan_video_model,
                base_precision=self.params.wan_video_precision,
                quantization=self.params.wan_video_quantization,
                load_device=self.params.wan_video_load_device,
                attention_mode="comfy",  # "sageattn", "flash_attn_2", "sdpa"
                rms_norm_function="default",
                compile_args=wanvideotorchcompilesettings[0],
                block_swap_args=wanvideoblockswap[0],
                lora=wanvideoloraselect[0],
                multitalk_model=multitalkmodelloader[0],
            )

            wanvideoclipvisionencode = self.wan_video_clip_vision_encode.process(
                strength_1=self.params.clip_vision_strength_1,
                strength_2=self.params.clip_vision_strength_2,
                crop=self.params.clip_vision_crop,
                combine_embeds=self.params.clip_vision_combine_embeds,
                force_offload=self.params.clip_vision_force_offload,
                tiles=0,
                ratio=0.5000000000000001,
                clip_vision=clipvisionloader[0],
                image_1=imageresizekjv2[0],
            )

            wanvideoimagetovideomultitalk = (
                self.wan_video_image_to_video_multi_talk.process(
                    width=self.params.width,
                    height=self.params.height,
                    frame_window_size=self.params.frame_window_size,
                    motion_frame=self.params.motion_frame,
                    force_offload=self.params.infinitetalk_force_offload,
                    colormatch=self.params.colormatch,
                    tiled_vae=True,
                    mode="infinitetalk",
                    output_path="",
                    vae=wanvideovaeloader[0],
                    start_image=imageresizekjv2[0],
                    clip_embeds=wanvideoclipvisionencode[0],
                )
            )

            wanvideotextencode = self.wan_video_text_encode.process(
                positive_prompt=self.params.positive_prompt,
                negative_prompt=self.params.negative_prompt,
                force_offload=True,
                use_disk_cache=True,
                device="gpu",
                t5=loadwanvideot5textencoder[0],
            )

            audiocrop = self.audio_crop.main(
                start_time=self.params.audio_start_time,
                end_time=self.params.audio_end_time,
                audio=loadaudio[0],
            )

            audiodurationmtb = self.audio_duration_mtb.get_duration(audio=audiocrop[0])

            audioseparation = self.audio_separation.main(
                chunk_fade_shape="linear",
                chunk_length=10,
                chunk_overlap=0.1,
                audio=audiocrop[0],
            )

            multitalkwav2vecembeds = self.multi_talk_wav2_vec_embeds.process(
                normalize_loudness=self.params.normalize_loudness,
                num_frames=(audiodurationmtb[0] / 1000) * self.params.fps,
                fps=self.params.fps,
                audio_scale=self.params.audio_scale,
                audio_cfg_scale=self.params.audio_cfg_scale,
                multi_audio_type=self.params.multi_audio_type,
                wav2vec_model=downloadandloadwav2vecmodel[0],
                audio_1=audioseparation[3],
            )

            wanvideosampler = self.wan_video_sampler.process(
                steps=self.params.sampling_steps,
                cfg=self.params.sampling_cfg,
                shift=self.params.sampling_shift,
                seed=self.params.sampling_seed,
                force_offload=self.params.sampling_force_offload,
                scheduler=self.params.sampling_scheduler,
                riflex_freq_index=self.params.riflex_freq_index,
                denoise_strength=0.98,  # 1
                batched_cfg=False,
                rope_function="comfy",
                start_step=0,
                end_step=-1,
                add_noise_to_samples=False,
                model=wanvideomodelloader[0],
                image_embeds=wanvideoimagetovideomultitalk[0],
                text_embeds=wanvideotextencode[0],
                samples=wanvideoencode[0],
                multitalk_embeds=multitalkwav2vecembeds[0],
            )

            wanvideodecode = self.wan_video_decode.decode(
                enable_vae_tiling=self.params.decode_vae_tiling,
                tile_x=self.params.decode_tile_x,
                tile_y=self.params.decode_tile_y,
                tile_stride_x=self.params.decode_tile_stride_x,
                tile_stride_y=self.params.decode_tile_stride_y,
                normalization="default",
                vae=wanvideovaeloader[0],
                samples=wanvideosampler[0],
            )

            video_out = self.vhs_video_combine.combine_video(
                frame_rate=self.params.fps,
                loop_count=self.params.video_loop_count,
                filename_prefix="video/output",
                format=self.params.video_format,
                pix_fmt="yuv420p",
                crf=19,
                save_metadata=True,
                trim_to_audio=False,
                pingpong=self.params.video_pingpong,
                save_output=self.params.video_save_output,
                images=wanvideodecode[0],
                audio=multitalkwav2vecembeds[1],
            )

            # Upload Video Output to MinIO
            gif_info = video_out["ui"]["gifs"][0]
            full_path = os.path.join(
                folder_paths.get_output_directory(),
                gif_info.get("subfolder", ""),
                gif_info["filename"],
            )

            with open(full_path, "rb") as f:
                video_data = f.read()

            artifact = upload_bytes(
                bucket="output",
                name=f"{uuid.uuid4().hex}.mp4",
                content=video_data,
                content_type="video/mp4",
            )
            return artifact.meta.model_dump(mode="json")
