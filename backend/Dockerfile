FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
# Production
# CMD ["node", "src/index.js"]
CMD ["node", "--inspect=0.0.0.0:9229", "src/index.js"]
