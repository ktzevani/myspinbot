# Use a slim Python image as the base
FROM python:3.13-slim

# Install curl and other essential networking tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install comfy-cli
RUN pip install --no-cache-dir comfy-cli

# Set the working directory
WORKDIR /loader

# The script will be mounted via compose, but we set the default command
ENTRYPOINT ["/bin/sh", "/fetch_models.sh"]