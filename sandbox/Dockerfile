FROM alpine:latest

# Install Linux essentials + git
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
    curl
RUN GOBIN=/usr/local/bin go install filippo.io/mkcert@latest

WORKDIR /workspace

CMD ["bash"]