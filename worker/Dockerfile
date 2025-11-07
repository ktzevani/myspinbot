FROM nvidia/cuda:13.0.0-cudnn-devel-ubuntu24.04

# ---- System Deps ------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl vim wget build-essential git patch \
    autoconf automake libtool pkg-config \
    python3 python3-pip python3-dev \
    libffi-dev libssl-dev zlib1g-dev \
    libjpeg-dev libpng-dev libtiff-dev libwebp-dev \
    libpq-dev libxml2-dev libxslt1-dev libsqlite3-dev \
    gfortran nodejs npm && \
    npm i -g pyright && \
    rm -rf /var/lib/apt/lists/*

# ---- Python Environment -----------------------------------------------------
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    ln -s /root/.local/bin/uv /usr/local/bin/uv && \
    ln -s /root/.local/bin/uvx /usr/local/bin/uvx

RUN mkdir -p /venv /app
ENV PATH=/venv/bin:$PATH
ENV VIRTUAL_ENV=/venv
WORKDIR /app

RUN uv venv --python "$(command -v python3)" /venv && \
    uv pip install --no-cache-dir numpy cython mako setuptools wheel pip ninja patchelf

# ---- CUDA / PyCUDA Compatibility Patch --------------------------------------
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

# ---- Add Orchestration/SDK Libraries ----------------------------------------
RUN uv pip install --no-cache-dir dramatiq pydantic prometheus-client minio langgraph

# ---- Install gdb ------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends gdb \
    && rm -rf /var/lib/apt/lists/*

# ---- Final setup ------------------------------------------------------------
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

COPY . /app
RUN uv pip install --no-cache-dir -e .[dev,test]
# Production version
# CMD ["python", "-m", "worker.main"]
CMD ["python", "-Xfrozen_modules=off", "-m", "worker.main"]