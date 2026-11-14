FROM node:22-bookworm-slim

# Install FFmpeg and DejaVu fonts for Sharp SVG overlay + MP4 rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock* package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build \
  && mkdir -p /app/data/videos /app/data/thumbs /app/data/images /app/data/music /app/data/uploads \
  && chmod -R 777 /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
