# Build stage
FROM node:20 AS build

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runtime

ARG NEXT_PUBLIC_API_URL NODE_ENV
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package*.json ./
RUN npm ci --omit=dev

EXPOSE 3001

CMD ["npm", "run", "start"]

# Development stage
FROM node:20 AS development

ARG NEXT_PUBLIC_API_URL NODE_ENV
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

COPY package*.json ./
RUN npm ci

EXPOSE 3001

CMD ["npm", "run", "dev"]
