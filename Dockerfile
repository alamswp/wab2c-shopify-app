FROM node:20-slim

WORKDIR /app

# Install deps first (better cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

ENV NODE_ENV=production

# Railway sets PORT; default to 3000 for local
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]

