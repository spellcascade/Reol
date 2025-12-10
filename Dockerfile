FROM node:20.11.1-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN apt-get update && \
    apt-get install -y ffmpeg curl unzip python3 make g++ sqlite3 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

RUN curl -fsSL https://deno.land/install.sh | sh && \
    mv /root/.deno/bin/deno /usr/local/bin/deno

WORKDIR /app

COPY package.json pnpm-lock.yaml tsconfig.json ./

RUN pnpm install
COPY . .
RUN pnpm run build

CMD ["node", "dist/index.js"]
