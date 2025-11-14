FROM python:3.12-slim AS python-tools
RUN pip install datamodel-code-generator

FROM node:20-alpine AS node-tools
RUN npm install -g ajv-cli

FROM node:20-alpine
COPY --from=python-tools /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=node-tools /usr/local/lib/node_modules /usr/local/lib/node_modules
ENV PATH="/usr/local/lib/node_modules/.bin:$PATH"
