FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-cache
COPY . .
CMD ["node", "index.js"]
