import os
import uuid
from minio import Minio
from ..models.worker.workflows_schema import AIUpscalerParams
import tempfile
import subprocess
import sys

_DEPS = dict()


def _concatenate_video_chunks_with_audio(
    chunk_filepaths, audio_filepath, output_filepath
):
    """
    Concatenates multiple video chunks and muxes with a separate audio file using FFmpeg.
    """
    if not chunk_filepaths:
        raise ValueError("No video chunks to concatenate.")
    if not os.path.exists(audio_filepath):
        raise FileNotFoundError(f"Audio file not found: {audio_filepath}")

    list_filepath = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt")
    for fpath in chunk_filepaths:
        list_filepath.write(f"file '{fpath}'\n")
    list_filepath.close()

    command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list_filepath.name,
        "-i",
        audio_filepath,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        output_filepath,
    ]
    _run_ffmpeg_command(command, list_filepath.name, "concatenation with audio")


def _save_audio_tensor_to_file(audio_tensor, sample_rate, output_filepath):
    """
    Saves an audio PyTorch tensor to a WAV file.
    audio_tensor: (channels, samples)
    """
    import torchaudio

    # Ensure audio_tensor is 2D (channels, samples) for torchaudio.save
    if audio_tensor.dim() == 1:
        audio_tensor = audio_tensor.unsqueeze(0)  # Add a channel dimension if mono
    torchaudio.save(output_filepath, audio_tensor.cpu(), sample_rate)


def _run_ffmpeg_command(
    command, temp_file_to_clean=None, error_context="FFmpeg operation"
):
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _, stderr = process.communicate()

    if temp_file_to_clean and os.path.exists(temp_file_to_clean):
        os.remove(temp_file_to_clean)

    if process.returncode != 0:
        print(f"{error_context} error: {stderr.decode()}")
        raise RuntimeError("Failed to create video")


def _ensure_initialized():
    global _DEPS

    if len(_DEPS) > 0:
        return

    import importlib
    from . import initialize_comfy_environment, load_comfy_module

    nodes_dir = initialize_comfy_environment()

    nodes_audio_module = load_comfy_module(
        os.path.join(nodes_dir, "comfy_extras", "nodes_upscale_model.py")
    )
    facerestore_cf_module = importlib.import_module("custom_nodes.facerestore_cf")
    comfyui_kjnodes_module = importlib.import_module("custom_nodes.comfyui-kjnodes")
    video_helpers_module = importlib.import_module(
        "custom_nodes.comfyui-videohelpersuite"
    )

    _DEPS.update({"UpscaleModelLoader": nodes_audio_module.UpscaleModelLoader})
    _DEPS.update({"ImageUpscaleWithModel": nodes_audio_module.ImageUpscaleWithModel})
    _DEPS.update(video_helpers_module.NODE_CLASS_MAPPINGS)
    _DEPS.update(facerestore_cf_module.NODE_CLASS_MAPPINGS)
    _DEPS.update(comfyui_kjnodes_module.NODE_CLASS_MAPPINGS)

    if len(_DEPS) == 0:
        raise RuntimeError(f"{__name__}: Failed to import dependencies.")


class AIUpscaler:
    def __init__(self, **kwargs):
        _ensure_initialized()
        self.params = AIUpscalerParams(**kwargs)
        self.upscale_model_loader = _DEPS["UpscaleModelLoader"]()
        self.image_upscale_with_model = _DEPS["ImageUpscaleWithModel"]()
        self.face_restore_model_loader = _DEPS["FaceRestoreModelLoader"]()
        self.face_restore_cf_with_model = _DEPS["FaceRestoreCFWithModel"]()
        self.vhs_load_video = _DEPS["VHS_LoadVideo"]()
        self.vhs_video_combine = _DEPS["VHS_VideoCombine"]()

    def estimate_progress_steps(self, videoStorageRef: str, batch_size: int):
        import folder_paths
        from ..config import get_config
        import math

        worker_config = get_config()
        client = Minio(
            worker_config.storage.url.replace("http://", "").replace("https://", ""),
            worker_config.storage.username,
            worker_config.storage.password,
            secure=worker_config.storage.url.startswith("https://"),
        )

        bucket, key = videoStorageRef.split("/", 1)
        input_dir = folder_paths.get_input_directory()
        os.makedirs(input_dir, exist_ok=True)

        local_filename = f"{uuid.uuid4().hex}_{os.path.basename(key)}"
        local_path = os.path.join(input_dir, local_filename)
        client.fget_object(bucket, key, local_path)

        vhsloadvideo = self.vhs_load_video.load_video(
            video=local_filename,
            force_rate=self.params.force_rate,
            custom_width=self.params.custom_width,
            custom_height=self.params.custom_height,
            frame_load_cap=self.params.frame_load_cap,
            skip_first_frames=self.params.skip_first_frames,
            select_every_nth=self.params.select_every_nth,
            format="AnimateDiff",
        )

        # this derived empirically
        steps = math.ceil(vhsloadvideo[1] / batch_size) * 11 + 10
        del vhsloadvideo

        return steps

    def run(self, videoStorageRef: str):
        import torch
        from ..config import get_config
        from ..services.tasks import upload_bytes
        import folder_paths
        import math
        import gc

        worker_config = get_config()
        client = Minio(
            worker_config.storage.url.replace("http://", "").replace("https://", ""),
            worker_config.storage.username,
            worker_config.storage.password,
            secure=worker_config.storage.url.startswith("https://"),
        )

        video_chunks = []

        with torch.inference_mode():

            upscalemodelloader = self.upscale_model_loader.EXECUTE_NORMALIZED(
                model_name=self.params.model_name_0
            )

            print(f"\tUpscaler loaded. Using {self.params.model_name_0}")

            facerestoremodelloader = self.face_restore_model_loader.load_model(
                model_name=self.params.model_name_1
            )

            # Load video from MinIO object storage
            bucket, key = videoStorageRef.split("/", 1)
            input_dir = folder_paths.get_input_directory()
            os.makedirs(input_dir, exist_ok=True)

            local_filename = f"{uuid.uuid4().hex}_{os.path.basename(key)}"
            local_path = os.path.join(input_dir, local_filename)
            client.fget_object(bucket, key, local_path)

            vhsloadvideo = self.vhs_load_video.load_video(
                video=local_filename,
                force_rate=self.params.force_rate,
                custom_width=self.params.custom_width,
                custom_height=self.params.custom_height,
                frame_load_cap=self.params.frame_load_cap,
                skip_first_frames=self.params.skip_first_frames,
                select_every_nth=self.params.select_every_nth,
                format="AnimateDiff",
            )

            print(
                f"\tAcquired video from object storage. Number of frames is {vhsloadvideo[1]}."
            )

            audio_file_path = tempfile.NamedTemporaryFile(
                mode="w", delete=False, suffix=".mp3"
            )
            audio_file_path.close()

            _save_audio_tensor_to_file(
                vhsloadvideo[2]["waveform"][0],
                vhsloadvideo[2]["sample_rate"],
                audio_file_path.name,
            )

            for i in range(
                math.ceil(vhsloadvideo[0].shape[0] / self.params.batch_size)
            ):

                print(
                    f"\tBatch {i+1}/{math.ceil(vhsloadvideo[0].shape[0] / self.params.batch_size)} is being processed..."
                )
                sys.stdout.flush()
                sys.stdout.write("\t\tUpscaling...\r")
                sys.stdout.flush()
                imageupscalewithmodel = (
                    self.image_upscale_with_model.EXECUTE_NORMALIZED(
                        upscale_model=upscalemodelloader[0],
                        image=vhsloadvideo[0][
                            i
                            * self.params.batch_size : (i + 1)
                            * self.params.batch_size
                        ],
                    )
                )

                sys.stdout.write("\t\tRestoring face...\r")
                sys.stdout.flush()
                facerestorecfwithmodel = self.face_restore_cf_with_model.restore_face(
                    facedetection=self.params.facedetection,
                    codeformer_fidelity=self.params.codeformer_fidelity,
                    facerestore_model=facerestoremodelloader[0],
                    image=imageupscalewithmodel[0],
                )
                sys.stdout.write("\t\tSaving chunk...\r")
                sys.stdout.flush()
                video_out = self.vhs_video_combine.combine_video(
                    frame_rate=vhsloadvideo[3]["source_fps"],
                    loop_count=0,
                    filename_prefix=f"video/{key.split('.')[0]}-chunk",
                    format="video/h264-mp4",
                    pix_fmt="yuv420p",
                    crf=19,
                    save_metadata=True,
                    trim_to_audio=False,
                    pingpong=False,
                    save_output=True,
                    images=facerestorecfwithmodel[0],
                )
                video_chunks.append(video_out["ui"]["gifs"][0]["fullpath"])
                del imageupscalewithmodel
                del facerestorecfwithmodel
                torch.cuda.empty_cache()
                gc.collect()

        print("\tVideo is processed, combining chunks to object storage...")
        sys.stdout.flush()

        video_chunks.append(video_out["ui"]["gifs"][0]["fullpath"])
        video_file_path = tempfile.NamedTemporaryFile(
            mode="w", delete=False, suffix=".mp4"
        )
        video_file_path.close()

        _concatenate_video_chunks_with_audio(
            video_chunks, audio_file_path.name, video_file_path.name
        )

        with open(video_file_path.name, "rb") as f:
            video_data = f.read()

        artifact = upload_bytes(
            bucket="output",
            name=f"{uuid.uuid4().hex}.mp4",
            content=video_data,
            content_type="video/mp4",
        )
        return artifact.meta.model_dump(mode="json")
