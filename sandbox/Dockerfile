FROM alpine:latest

# Install Linux essentials + git
RUN apk add --no-cache \
    bash \
    git \
    ca-certificates \
    openssh \
    curl

WORKDIR /workspace

CMD ["bash"]