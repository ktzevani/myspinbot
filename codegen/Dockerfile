FROM node:22-slim

# Install Python, pip, and bash
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip bash \
    && ln -s /usr/bin/python3 /usr/local/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Python tooling
RUN pip3 install --break-system-packages --no-cache-dir datamodel-code-generator

# Node tooling
RUN npm install -g ajv ajv-cli ajv-formats

# Make sure both Python and Node tools are easily found
ENV PATH="/usr/local/bin:/usr/local/lib/node_modules/.bin:$PATH"

WORKDIR /work
