FROM node:20-alpine
WORKDIR /app
# cache-bust: 2026-03-30-v10
RUN apk add --no-cache font-noto
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "index.js"]
