FROM node:20-alpine

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

RUN [ "$NODE_ENV" = "development" ] && apk add --no-cache git || true

WORKDIR /app

COPY ./backend/package*.json ./
RUN npm ci $( [ "$NODE_ENV" = "production" ] && echo "--omit=dev" );

COPY ./backend .
RUN mv /app/docker-entrypoint.sh /usr/local/bin
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY ./common/config ./config

EXPOSE 3000

ENTRYPOINT [ "docker-entrypoint.sh" ]