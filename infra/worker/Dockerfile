# ==========================================
# STAGE 1: Heavy System Setup
# ==========================================
FROM nvidia/cuda:13.0.2-cudnn-devel-ubuntu22.04 AS base-system

ARG PYTHON_VERSION
ENV PYTHON_VERSION=${PYTHON_VERSION}

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
    python3-pip \
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

RUN mkdir -p /opt/uv-cache
ENV UV_CACHE_DIR=/opt/uv-cache

RUN mkdir -p /venv
ENV PATH=/venv/bin:$PATH \
    VIRTUAL_ENV=/venv

RUN uv python install ${PYTHON_VERSION} && uv venv --python ${PYTHON_VERSION} /venv && \
    uv pip install numpy cython mako setuptools wheel pip ninja patchelf

ENV TORCH_CUDA_ARCH_LIST="8.6;8.9;12.0" \
    UV_HTTP_TIMEOUT=240 \
    CFLAGS="-Wno-error=deprecated-declarations -DCUDA_DISABLE_DEPRECATION_WARNINGS" \
    CXXFLAGS="-Wno-error=deprecated-declarations -DCUDA_DISABLE_DEPRECATION_WARNINGS" \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

# ---- CUDA / PyCUDA Compatibility Patch ----

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

# ==========================================
# STAGE 2: Dependencies setup
# ==========================================
FROM base-system AS dependencies

RUN uv pip install \
    torch torchvision torchaudio  \
    --index-url https://download.pytorch.org/whl/cu130 \
    --extra-index-url https://pypi.nvidia.com
RUN echo "PyTorch Installed."

RUN uv pip install \
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
    llvmlite \
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
    ultralytics 
RUN echo "ComfyUI Dependencies 1/3 Installed"

RUN uv pip install --no-build-isolation \
    faiss-cpu \
    vector-quantize-pytorch \ 
    torchcrepe \
    ftfy \
    onnxruntime-gpu
RUN echo "ComfyUI Dependencies 2/3 Installed"

RUN uv pip install --no-build-isolation \
    gguf \
    pyloudnorm \
    color_matcher \
    ipykernel \
    ipywidgets \
    ipympl \
    sounddevice
RUN echo "ComfyUI Dependencies 3/3 Installed"

ENV MAX_JOBS=6 \
    NVCC_THREADS=3 \
    CMAKE_BUILD_PARALLEL_LEVEL=6

RUN uv pip install --no-build-isolation git+https://github.com/Dao-AILab/flash-attention.git
RUN echo "Flash Attention is built"

RUN uv pip install --no-build-isolation git+https://github.com/thu-ml/SageAttention.git
RUN echo "Sage Attention is built"

# ==========================================
# STAGE 3: ComfyUI setup
# ==========================================
FROM dependencies AS comfyui-system

ARG WORKER_MODE
ENV WORKER_MODE=${WORKER_MODE}
ENV WORKER_HOME=/opt/${WORKER_MODE}

# ---- Setup working directory ----

WORKDIR ${WORKER_HOME}

RUN [ "$WORKER_MODE" = "comfyui" ] && git clone https://github.com/comfyanonymous/ComfyUI.git . && \
    cd $WORKER_HOME/custom_nodes && git clone https://github.com/ltdrdata/ComfyUI-Manager.git comfyui-manager && \
    git clone https://github.com/diodiogod/TTS-Audio-Suite.git tts_audio_suite && \
    git clone https://github.com/kijai/ComfyUI-WanVideoWrapper.git ComfyUI-WanVideoWrapper && \
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git comfyui-videohelpersuite && \
    git clone https://github.com/christian-byrne/audio-separation-nodes-comfyui.git audio-separation-nodes-comfyui && \
    git clone https://github.com/melMass/comfy_mtb.git comfy-mtb && \
    git clone https://github.com/kijai/ComfyUI-KJNodes.git comfyui-kjnodes && \
    git clone https://github.com/mav-rik/facerestore_cf facerestore_cf || true

RUN [ "$WORKER_MODE" = "comfyui" ] && uv pip install -r requirements.txt || true
RUN [ "$WORKER_MODE" = "comfyui" ] && cd $WORKER_HOME/custom_nodes/comfyui-manager && uv pip install -r requirements.txt || true
RUN [ "$WORKER_MODE" = "comfyui" ] && cd $WORKER_HOME/custom_nodes/tts_audio_suite && uv pip install -r requirements.txt || true
RUN [ "$WORKER_MODE" = "comfyui" ] && cd $WORKER_HOME/custom_nodes/ComfyUI-WanVideoWrapper && uv pip install -r requirements.txt || true
RUN [ "$WORKER_MODE" = "comfyui" ] && cd $WORKER_HOME/custom_nodes/comfyui-videohelpersuite && uv pip install -r requirements.txt || true
RUN [ "$WORKER_MODE" = "comfyui" ] && cd $WORKER_HOME/custom_nodes/audio-separation-nodes-comfyui && uv pip install -r requirements.txt || true
RUN [ "$WORKER_MODE" = "comfyui" ] && cd $WORKER_HOME/custom_nodes/comfy-mtb && uv pip install -r requirements.txt || true
RUN [ "$WORKER_MODE" = "comfyui" ] && cd $WORKER_HOME/custom_nodes/comfyui-kjnodes && uv pip install -r requirements.txt || true
RUN [ "$WORKER_MODE" = "comfyui" ] && cd $WORKER_HOME/custom_nodes/facerestore_cf && uv pip install -r requirements.txt || true

# ==========================================
# STAGE 4: MySpinBot setup
# ==========================================
FROM comfyui-system AS worker

ARG WORKER_ENVIRONMENT
ENV WORKER_ENVIRONMENT=${WORKER_ENVIRONMENT}

COPY ./worke[r] .
COPY ./commo[n]/config ./config
COPY ./docker-entrypoint.s[h] ./docker-entrypoint.sh

RUN [ "$WORKER_MODE" = "app" ] && [ "$WORKER_ENVIRONMENT" = "production" ] && \
    uv pip install --no-cache-dir -e .[dev,test] && \
    echo "Python worker dependencies installed" || true

RUN mv $WORKER_HOME/docker-entrypoint.sh /usr/local/bin
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]