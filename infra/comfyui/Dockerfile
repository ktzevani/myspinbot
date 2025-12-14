FROM nvidia/cuda:13.0.2-cudnn-devel-ubuntu24.04

# ---- System Deps ----

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y --fix-missing && apt-get install -y \
    locales \
    ca-certificates \
    && apt-get clean

# UTF-8
RUN localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8
ENV LANG=en_US.utf8
ENV LC_ALL=en_US.UTF-8

RUN apt-get update -y --fix-missing \
    && apt-get install -y --no-install-recommends \
    autoconf \
    automake \
    build-essential \
    curl \
    ffmpeg \
    gdb \
    gfortran \
    git \
    git-lfs \
    gnupg \
    libcairo2-dev \
    libffi-dev \
    libglib2.0-0 \
    libjpeg-dev \
    libpango1.0-dev \
    libpng-dev \
    libportaudio2 \
    libpq-dev \
    libsm6 \
    libsqlite3-dev \
    libssl-dev \
    libtiff-dev \
    libtool \
    libwebp-dev \
    libxext6 \
    libxml2-dev \
    libxrender1 \
    libxslt1-dev \
    nodejs \
    npm \
    patch \
    pkg-config \
    portaudio19-dev \
    python3 \
    python3-dev \
    python3-pip \
    python3-venv \
    python3.12-venv \
    rsync \
    socat \
    unzip \
    vim \
    wget \
    zip \
    zlib1g \
    zlib1g-dev \
    && git lfs install \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Add libEGL ICD loaders and libraries + Vulkan ICD loaders and libraries
# Per https://github.com/mmartial/ComfyUI-Nvidia-Docker/issues/26
RUN apt-get update && apt-get install -y libglvnd0 libglvnd-dev libegl1-mesa-dev libvulkan1 libvulkan-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /usr/share/glvnd/egl_vendor.d \
    && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json \
    && mkdir -p /usr/share/vulkan/icd.d \
    && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' > /usr/share/vulkan/icd.d/nvidia_icd.json
ENV MESA_D3D12_DEFAULT_ADAPTER_NAME="NVIDIA"

# ---- Python Environment ----

RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    ln -s /root/.local/bin/uv /usr/local/bin/uv && \
    ln -s /root/.local/bin/uvx /usr/local/bin/uvx

RUN mkdir -p /venv
ENV PATH=/venv/bin:$PATH
ENV VIRTUAL_ENV=/venv

RUN uv venv --python "$(command -v python3)" /venv && \
    uv pip install --no-cache-dir numpy cython mako setuptools wheel pip ninja patchelf

# ---- CUDA / PyCUDA Compatibility Patch ----
ENV TORCH_CUDA_ARCH_LIST="8.6;8.9;12.0"
ENV CFLAGS="-Wno-error=deprecated-declarations -DCUDA_DISABLE_DEPRECATION_WARNINGS" \
    CXXFLAGS="-Wno-error=deprecated-declarations -DCUDA_DISABLE_DEPRECATION_WARNINGS"

RUN printf '%s\n' \
    'def get_config():' \
    '    return {' \
    '        "CUDA_ROOT": "/usr/local/cuda",' \
    '        "CUDADRV_LIB_DIR": "/usr/local/cuda/lib64/stubs",' \
    '        "CUDADRV_LIB_NAME": "cuda",' \
    '    }' > /root/.aksetup-defaults.py

RUN mkdir -p /tmp/src && \
    pip download --no-binary=:all: --no-deps --index-url https://pypi.org/simple -d /tmp/src pycuda==2025.1.1 && \
    tar -C /tmp/src -xf /tmp/src/pycuda-*.tar.* && \
    bash -lc 'ls -d /tmp/src/pycuda-* | head -n1' > /tmp/pycuda_dir && \
    cd "$(cat /tmp/pycuda_dir)" && \
    printf '%s\n' \
    '--- a/src/cpp/cuda.hpp' \
    '+++ b/src/cpp/cuda.hpp' \
    '@@ -856,11 +856,16 @@' \
    '   inline' \
    '   boost::shared_ptr<context> device::make_context(unsigned int flags)' \
    '   {' \
    '     context::prepare_context_switch();' \
    '' \
    '     CUcontext ctx;' \
    '-    CUDAPP_CALL_GUARDED_THREADED(cuCtxCreate, (&ctx, flags, m_device));' \
    '+#if CUDAPP_CUDA_VERSION >= 13000' \
    '+    CUctxCreateParams params{};' \
    '+    CUDAPP_CALL_GUARDED_THREADED(cuCtxCreate, (&ctx, &params, flags, m_device));' \
    '+#else' \
    '+    CUDAPP_CALL_GUARDED_THREADED(cuCtxCreate, (&ctx, flags, m_device));' \
    '+#endif' \
    '     boost::shared_ptr<context> result(new context(ctx));' \
    '     context_stack::get().push(result);' \
    '     return result;' \
    '   }' > cu13.patch && \
    patch -p1 < cu13.patch && \
    uv pip install -v --no-cache-dir --no-build-isolation .


ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    COMFY_HOME=/opt/comfyui

# ---- Setup ComfyUI working directory ----

RUN mkdir -p $COMFY_HOME
WORKDIR $COMFY_HOME

RUN git clone https://github.com/comfyanonymous/ComfyUI.git .
RUN git config --global --add safe.directory $COMFY_HOME
RUN git config --global --add safe.directory $COMFY_HOME/custom_nodes/comfyui-f5-tts

RUN uv pip install --no-cache-dir \
    -r requirements.txt \
    audio_separator \
    cached_path \
    conformer \
    dac \
    dacite \
    diffusers \
    dramatiq \
    f5-tts \
    insightface \
    jieba \
    kokoro_onnx \
    langgraph \
    lpips \
    minio \
    moviepy \
    omegaconf \
    opencv-python \
    prometheus-client \
    protobuf \
    pydantic \
    pygit2 \
    pyright \
    s3tokenizer \
    sageattention \
    torch \
    torchcrepe \
    ultralytics \
    vector-quantize-pytorch

RUN uv pip install --no-cache-dir --no-build-isolation \
    ftfy \
    onnxruntime \
    gguf \
    pyloudnorm \
    faiss-cpu \
    sounddevice

CMD ["sh", "-c", "python main.py $CLI_ARGS"]