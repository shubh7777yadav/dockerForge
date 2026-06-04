# ─── Server Dockerfile ───────────────────────────────────────────────────────
FROM node:20-alpine

# Install git (required by simple-git to clone repos) and docker CLI
# docker CLI is needed so the server can run "docker build" on the host socket
RUN apk add --no-cache git docker-cli

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

EXPOSE 5000

CMD ["node", "index.js"]
