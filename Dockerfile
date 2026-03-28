FROM node:20-alpine
WORKDIR /app
# cache-bust: 2026-03-28-v7
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "index.js"]
