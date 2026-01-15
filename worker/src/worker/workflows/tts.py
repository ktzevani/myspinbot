from io import BytesIO
import uuid
from minio import Minio
from ..models.worker.workflows_schema import TextToSpeechParams

_DEPS = dict()


def _ensure_initialized():
    global _DEPS

    if len(_DEPS) > 0:
        return

    import os
    import importlib.util
    from . import initialize_comfy_environment

    comfy_root_dir = initialize_comfy_environment()
    tts_nodes_dir = os.path.join(
        comfy_root_dir, "custom_nodes", "tts_audio_suite", "nodes"
    )

    f5tts_node_path = os.path.join(tts_nodes_dir, "f5tts", "f5tts_node.py")
    f5tts_spec = importlib.util.spec_from_file_location("f5tts_module", f5tts_node_path)

    if f5tts_spec is not None:
        f5tts_module = importlib.util.module_from_spec(f5tts_spec)
        f5tts_spec.loader.exec_module(f5tts_module)
        _DEPS.update({"F5TTSNode": f5tts_module.F5TTSNode})

    if len(_DEPS) == 0:
        raise RuntimeError(f"{__name__}: Failed to import dependencies.")


class TextToSpeech:
    def __init__(self, **kwargs):
        _ensure_initialized()
        self.params = TextToSpeechParams(**kwargs)
        self.engine_instance = _DEPS["F5TTSNode"]()
        setattr(self.engine_instance, "device", self.params.device)

    def estimate_progress_steps(self, text: str, tokens_per_iteration: int = 60):
        import math

        steps = 14 + 3 * math.floor(len(text.split(" ")) / tokens_per_iteration)
        return steps

    def run(self, text: str):
        """Execute TTS generation using MinIO for inputs and outputs."""
        from ..config import get_config
        from ..services.tasks import upload_bytes
        import torchaudio.transforms as T
        import scipy.io.wavfile as wavfile
        import torchaudio
        import torch

        worker_config = get_config()
        client = Minio(
            worker_config.storage.url.replace("http://", "").replace("https://", ""),
            worker_config.storage.username,
            worker_config.storage.password,
            secure=worker_config.storage.url.startswith("https://"),
        )

        bucket, key = self.params.narrator_voice.split("/", 1)
        response = client.get_object(bucket, key)
        try:
            ref_audio_data = BytesIO(response.read())
            waveform, sample_rate = torchaudio.load(ref_audio_data)
        finally:
            response.close()
            response.release_conn()

        result = self.engine_instance.generate_speech(
            reference_audio_file="none",
            opt_reference_text=self.params.ref_text,
            device=self.params.device,
            model=self.params.model,
            seed=self.params.seed,
            text=text,
            opt_reference_audio={
                "waveform": waveform,
                "sample_rate": sample_rate,
            },
            temperature=self.params.temperature,
            speed=self.params.speed,
            target_rms=self.params.target_rms,
            cross_fade_duration=self.params.cross_fade_duration,
            nfe_step=self.params.nfe_step,
            cfg_strength=self.params.cfg_strength,
            auto_phonemization=False,
            enable_chunking=True,
            max_chars_per_chunk=400,
            chunk_combination_method="auto",
            silence_between_chunks_ms=400,
            enable_audio_cache=True,
        )

        out_waveform, out_sample_rate = list(result[0].values())

        out_waveform = out_waveform.to(torch.float32)
        if out_waveform.ndim == 1:
            out_waveform = out_waveform.unsqueeze(0)

        target_sample_rate = 16000
        if out_sample_rate != target_sample_rate:
            resampler = (
                T.Resample(orig_freq=out_sample_rate, new_freq=target_sample_rate)
                .to(out_waveform.device)
                .to(out_waveform.dtype)
            )

            out_waveform = resampler(out_waveform)
            out_sample_rate = target_sample_rate

        audio_tensor = out_waveform.cpu()

        if audio_tensor.abs().max() > 0:  # Avoid division by zero for silent audio
            if audio_tensor.abs().max() > 1.0:
                audio_tensor = audio_tensor / audio_tensor.abs().max()

        audio_tensor = torch.clamp(audio_tensor, -1.0, 1.0)
        audio_data = audio_tensor.mean(dim=0).numpy().astype("float32")

        output_buffer = BytesIO()
        wavfile.write(output_buffer, out_sample_rate, audio_data.T)

        artifact = upload_bytes(
            bucket="speech",
            name=f"{uuid.uuid4().hex}.wav",
            content=output_buffer.getvalue(),
            content_type="audio/wav",
        )
        return artifact.meta.model_dump(mode="json")


__all__ = ["TextToSpeech"]
