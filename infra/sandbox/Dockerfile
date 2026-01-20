FROM node:20-alpine

# 1. Install Linux essentials, git, and Python 3 (required for gcloud)
RUN apk add --no-cache \
    bash \
    git \
    ca-certificates \
    openssh \
    vim \
    apache2 \
    apache2-utils \
    go \
    nss \
    curl \
    python3 \
    py3-pip \
    libc6-compat

# 2. Install mkcert (Your original logic)
RUN GOBIN=/usr/local/bin go install filippo.io/mkcert@latest

# 3. Install Google Cloud CLI (Verified 2026 Alpine Method)
ENV SDK_DIR=/usr/local/lib
RUN curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir=$SDK_DIR

# 4. Add gcloud and Gemini CLI to PATH
ENV PATH=$PATH:$SDK_DIR/google-cloud-sdk/bin

# 5. Install Gemini CLI globally
RUN npm install -g @google/gemini-cli

WORKDIR /workspace

CMD ["bash"]