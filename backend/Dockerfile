FROM node:20-alpine

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

WORKDIR /app

COPY package*.json ./
RUN npm ci $( [ "$NODE_ENV" = "production" ] && echo "--omit=dev" );

COPY . .
RUN mv /app/docker-entrypoint.sh /usr/local/bin
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT [ "docker-entrypoint.sh" ]