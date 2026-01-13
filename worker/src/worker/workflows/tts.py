import torchaudio
from io import BytesIO
import av
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

    def run(self, text: str):
        """Execute TTS generation using MinIO for inputs and outputs."""
        from ..config import get_config
        from ..services.tasks import upload_bytes

        worker_config = get_config()
        client = Minio(
            worker_config.storage.url.replace("http://", "").replace("https://", ""),
            worker_config.storage.username,
            worker_config.storage.password,
            secure=worker_config.storage.url.startswith("https://"),
        )

        # Download reference audio from MinIO (expected format: "bucket/key")
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
        layout = "mono"
        output_buffer = BytesIO()
        with av.open(output_buffer, mode="w", format="mp3") as output_container:
            out_stream = output_container.add_stream(
                "libmp3lame", rate=out_sample_rate, layout=layout
            )
            out_stream.codec_context.qscale = 1
            frame = av.AudioFrame.from_ndarray(
                out_waveform.movedim(0, 1).reshape(1, -1).float().numpy(),
                format="flt",
                layout=layout,
            )
            frame.sample_rate = out_sample_rate
            frame.pts = 0
            output_container.mux(out_stream.encode(frame))
            output_container.mux(out_stream.encode(None))

        # Upload result to MinIO and return metadata
        artifact = upload_bytes(
            bucket="audio",
            name=f"{uuid.uuid4().hex}.mp3",
            content=output_buffer.getvalue(),
            content_type="audio/mpeg",
        )
        return artifact.meta.model_dump(mode="json")


__all__ = ["TextToSpeech"]
