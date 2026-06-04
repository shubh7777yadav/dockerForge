# 🐳 Dockerfile AI Agent

An AI-powered agent that accepts a public GitHub repository URL, clones and analyzes the codebase, generates a working Dockerfile, builds it, and automatically retries with AI-guided fixes if the build fails — all visible in real time through a browser UI.

---

## Table of Contents

- [Live Demo Flow](#live-demo-flow)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [LLM Provider — Why Gemini](#llm-provider--why-gemini)
- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
  - [Option A — Docker (Recommended)](#option-a--docker-recommended)
  - [Option B — Local Development](#option-b--local-development)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [How the Agent Works](#how-the-agent-works)
- [Known Limitations & Edge Cases](#known-limitations--edge-cases)

---

## Live Demo Flow

```
User pastes GitHub URL
        │
        ▼
  Agent clones repo  ──►  Scans file structure
        │
        ▼
  Gemini AI generates Dockerfile
        │
        ▼
  docker build runs (live logs stream to UI)
        │
     ┌──┴──┐
   PASS   FAIL
     │      │
     │      ▼
     │   Gemini reads error → generates fix
     │      │
     │      ▼
     │   Retry (max 3 attempts)
     │      │
     ▼      ▼
  Final Dockerfile displayed in UI
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Network: agent-net                     │
│                                                                      │
│  ┌──────────────────┐      ┌──────────────────┐      ┌───────────┐  │
│  │   client:80      │      │   server:5000    │      │ mongo:    │  │
│  │                  │      │                  │      │ 27017     │  │
│  │  React 18        │◄────►│  Express.js      │◄────►│           │  │
│  │  nginx reverse   │      │  Socket.IO       │      │ MongoDB 7 │  │
│  │  proxy           │      │  Agent Logic     │      │           │  │
│  │                  │      │                  │      │ Stores:   │  │
│  │  Components:     │      │  Services:       │      │ - Jobs    │  │
│  │  - InputForm     │      │  - githubService │      │ - Logs    │  │
│  │  - StepsTimeline │      │  - aiService     │      │ - Status  │  │
│  │  - LogViewer     │      │  - dockerService │      │           │  │
│  │  - DockerfileView│      │                  │      └───────────┘  │
│  │  - StatusBadge   │      │  Gemini 1.5 Flash│                     │
│  └──────────────────┘      │  (external API)  │                     │
│         ▲                  └────────┬─────────┘                     │
│         │  WebSocket (Socket.IO)    │                               │
│         └──────────────────────────┘                               │
│                                     │ /var/run/docker.sock          │
└─────────────────────────────────────┼─────────────────────────────┘
                                      │
                              ┌───────▼────────┐
                              │  Host Docker   │
                              │  Daemon        │
                              │                │
                              │  docker build  │
                              │  docker run    │
                              │  docker rmi    │
                              └────────────────┘
```

### Request / Data Flow

```
Browser
  │
  │  1. POST /api/agent/start  { repoUrl }
  ▼
Express Server
  │
  ├─ 2. Creates Job in MongoDB  (status: pending)
  ├─ 3. Responds immediately with { jobId }
  │
  └─ 4. Runs agent pipeline async:
         │
         ├─ githubService.cloneRepo()      → git clone --depth 1
         ├─ githubService.scanDirectory()  → recursive file tree
         ├─ githubService.readKeyFiles()   → package.json, requirements.txt, etc.
         │
         ├─ aiService.generateDockerfile() → Gemini 1.5 Flash API call
         │
         └─ Loop (max 3 attempts):
               ├─ dockerService.writeDockerfile()
               ├─ dockerService.buildImage()   → docker build (live stdout/stderr)
               │      │
               │   on fail:
               │      └─ aiService.fixDockerfile()  → Gemini reads error, returns fix
               │
               └─ on success:
                     ├─ dockerService.runContainer() → verify image is valid
                     └─ dockerService.cleanupImage()

  Each step emits Socket.IO events → browser receives live status + logs
```

---

## Project Structure

```
dev/
├── docker-compose.yml          ← Orchestrates all 3 services
├── .env.example                ← Environment variable template
│
├── server/
│   ├── Dockerfile              ← node:20-alpine + git + docker-cli
│   ├── .dockerignore
│   ├── package.json
│   ├── index.js                ← Express + Socket.IO entry point
│   ├── .env                    ← Local dev env (not committed)
│   ├── models/
│   │   └── Job.js              ← Mongoose schema
│   ├── routes/
│   │   └── agent.js            ← POST /start, GET /job/:id, runAgent()
│   └── services/
│       ├── aiService.js        ← Gemini generateDockerfile + fixDockerfile
│       ├── githubService.js    ← clone, scan, readKeyFiles
│       └── dockerService.js   ← buildImage, runContainer, cleanupImage
│
└── client/
    ├── Dockerfile              ← Multi-stage: node:20-alpine build → nginx:1.25
    ├── .dockerignore
    ├── nginx.conf              ← Reverse proxy /api + /socket.io → server
    ├── package.json
    └── src/
        ├── index.js
        ├── App.jsx             ← Main app, socket connection, state
        └── components/
            ├── InputForm.jsx       ← GitHub URL input + submit button
            ├── StepsTimeline.jsx   ← Visual 5-step progress bar
            ├── StatusBadge.jsx     ← Animated status pill
            ├── LogViewer.jsx       ← Auto-scrolling live build logs
            └── DockerfilePreview.jsx ← Syntax-highlighted Dockerfile + copy
```

---

## LLM Provider — Why Gemini

This project uses **Google Gemini 1.5 Flash** via the `@google/generative-ai` SDK.

| Consideration | Decision |
|---|---|
| **Speed** | Gemini 1.5 Flash is one of the fastest models available — critical here since every build retry requires a fresh AI call. Average response time is 2–4 seconds. |
| **Context window** | 1 million token context window. Handles even large `package.json` files, full file trees, and long build error logs in a single prompt without truncation issues. |
| **Free tier** | Google AI Studio provides a generous free tier (15 RPM, 1M TPM) — no credit card needed to get started, making it accessible for evaluation. |
| **Cost** | Gemini 1.5 Flash is significantly cheaper than GPT-4o for high-volume usage ($0.075 per 1M input tokens vs $5.00). |
| **Code quality** | Produces accurate, minimal Dockerfiles when given structured prompts. Understands multi-stage builds, base image selection, and framework-specific patterns. |
| **Why not GPT-4o** | OpenAI requires paid API access for GPT-4o. Gemini Flash provides comparable Dockerfile generation quality at a fraction of the cost with a free entry point. |
| **Why not Claude** | Anthropic's API has stricter rate limits on free tiers and higher latency on equivalent tasks. |

The model is called twice per failed attempt:
1. `generateDockerfile` — initial generation from repo analysis
2. `fixDockerfile` — error-aware fix when `docker build` fails

Both prompts instruct the model to return **raw Dockerfile content only** (no markdown, no explanation). A `stripCodeFences()` sanitizer handles cases where Gemini wraps output in triple backticks despite the instruction.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 | UI, real-time log display |
| Styling | Inline CSS (dark theme) | Zero-dependency styling |
| Real-time | Socket.IO client | Live log streaming from server |
| HTTP client | Axios | REST API calls |
| Backend | Express.js 4 | REST API + Socket.IO server |
| Real-time | Socket.IO | Push logs/status to browser |
| AI | Google Gemini 1.5 Flash | Dockerfile generation + error fixing |
| Git | simple-git | Clone public GitHub repositories |
| Docker | Docker CLI (host socket) | Build and verify generated images |
| Database | MongoDB 7 + Mongoose | Persist job state, logs, Dockerfiles |
| Proxy | nginx 1.25 | Serve React build + proxy API in Docker |
| Containers | Docker + Docker Compose | Full stack orchestration |

---

## Setup Instructions

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A Gemini API key — get one free at [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

---

### Option A — Docker (Recommended)

This runs the entire stack (React, Express, MongoDB) with a single command.

**1. Clone this repository**

```bash
git clone https://github.com/your-username/dockerfile-agent.git
cd dockerfile-agent
```

**2. Create your `.env` file**

```bash
cp .env.example .env
```

Open `.env` and set your key:

```env
GEMINI_API_KEY=your_actual_gemini_key_here
```

**3. Build and start all services**

```bash
docker compose up --build
```

This will:
- Build the Express server image (`node:20-alpine` with `git` and `docker-cli`)
- Build the React client image (multi-stage: Node build → nginx serve)
- Pull MongoDB 7
- Start all three containers on the `agent-net` bridge network

**4. Open the app**

```
http://localhost:3000
```

**5. Stop the stack**

```bash
docker compose down
```

To also remove the MongoDB volume:

```bash
docker compose down -v
```

> **Note on Docker-in-Docker:** The server container mounts the host Docker socket (`/var/run/docker.sock`) so it can run `docker build` against the host daemon. This means images built by the agent appear in your host's `docker images` list. The agent automatically cleans them up after verification with `docker rmi`.

---

### Option B — Local Development

Run each service individually without Docker.

**Prerequisites:** Node.js 20+, MongoDB running locally, Docker Desktop running, Git installed.

**1. Install server dependencies**

```bash
cd server
npm install
```

**2. Configure server environment**

Edit `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/dockerfile-agent
GEMINI_API_KEY=your_actual_gemini_key_here
```

**3. Start the server**

```bash
cd server
npm run dev
```

Server starts on `http://localhost:5000`

**4. Install client dependencies**

```bash
cd client
npm install
```

**5. Start the React app**

```bash
cd client
npm start
```

React app starts on `http://localhost:3000`. The `"proxy": "http://localhost:5000"` in `client/package.json` forwards `/api` calls automatically.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key |
| `MONGO_URI` | ✅ Yes | MongoDB connection string |
| `PORT` | No | Express server port (default: `5000`) |

In Docker mode, `MONGO_URI` is automatically set to `mongodb://mongo:27017/dockerfile-agent` by `docker-compose.yml`. You only need to provide `GEMINI_API_KEY` in your `.env` file.

---

## API Reference

### `POST /api/agent/start`

Start an agent job for a GitHub repository.

**Request body:**
```json
{ "repoUrl": "https://github.com/username/repo" }
```

**Response:**
```json
{ "jobId": "550e8400-e29b-41d4-a716-446655440000" }
```

---

### `GET /api/agent/job/:jobId`

Fetch the current state of a job.

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repoUrl": "https://github.com/username/repo",
  "status": "success",
  "dockerfile": "FROM node:20-alpine\n...",
  "logs": ["Cloning repository...", "..."],
  "attempts": 2,
  "error": "",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:01:30.000Z"
}
```

**Status values:** `pending` → `cloning` → `analyzing` → `generating` → `building` → `success` / `failed`

---

### Socket.IO Events

Connect to the server and listen on `job:<jobId>` for real-time updates:

```js
socket.on(`job:${jobId}`, ({ event, data }) => {
  // event = "log"        → data is a log line string
  // event = "status"     → data is the new status string
  // event = "dockerfile" → data is the current Dockerfile string
});
```

---

## How the Agent Works

```
Step 1 — CLONE
  git clone --depth 1 <repoUrl>
  Clones into OS temp directory (/tmp/dockerfile-agent-repos/<jobId>)
  --depth 1 keeps it fast (no full history needed)

Step 2 — ANALYZE
  Recursively scans the directory tree (max depth 4)
  Skips: node_modules, .git, __pycache__, dist, build, venv
  Reads key config files: package.json, requirements.txt, go.mod,
  pom.xml, Pipfile, pyproject.toml, Cargo.toml, Gemfile, etc.

Step 3 — GENERATE
  Sends file tree + key file contents to Gemini 1.5 Flash
  Prompt instructs: detect framework, pin base image versions,
  use multi-stage builds, expose correct port, set CMD

Step 4 — BUILD
  Writes Dockerfile to the cloned repo root
  Runs: docker build -t dockerfile-agent-<jobId[:8]> .
  Streams stdout + stderr line-by-line to the UI via Socket.IO

Step 5 — VERIFY or RETRY (max 3 attempts)
  On success: docker run --rm --entrypoint echo <image> container-ok
              docker rmi -f <image>  (cleanup)
  On failure: send error log back to Gemini → get fixed Dockerfile
              increment attempt counter → go to Step 4
```

---

## Known Limitations & Edge Cases

### Repository Limitations

- **Private repositories are not supported.** The agent uses unauthenticated `git clone`. Only public GitHub repos work.
- **Monorepos with multiple apps** may produce a Dockerfile targeting only the root. The agent does not detect sub-project structure automatically.
- **Very large repositories** (>500MB) will be slow to clone. The `--depth 1` flag minimizes this but network speed is still a factor.
- **Repos with no recognizable config files** (e.g. a raw C project with only `.c` files and a `Makefile`) may produce a generic or incorrect Dockerfile since the AI has less signal to work with.

### Docker Limitations

- **The server container requires access to the host Docker socket** (`/var/run/docker.sock`). This works on Linux and macOS. On **Windows with Docker Desktop**, the socket path may differ — use `npx.pipe` or switch to Docker Desktop's WSL2 backend which exposes the standard socket path.
- **Images built by the agent remain on the host** until cleaned up. The agent calls `docker rmi` after verification but if the process crashes mid-job, orphaned images tagged `dockerfile-agent-*` may remain. Clean them with: `docker rmi $(docker images 'dockerfile-agent-*' -q)`.
- **Docker build context size** — the entire cloned repo is sent as build context. Repos without a `.dockerignore` and large asset folders will be slow.

### AI Limitations

- **Max 3 retry attempts.** If Gemini cannot fix the Dockerfile within 3 tries (e.g. the repo requires proprietary build tooling, paid dependencies, or complex secrets), the job will fail. The final Dockerfile is still displayed so you can fix it manually.
- **Gemini 1.5 Flash rate limits** on the free tier are 15 requests per minute and 1 million tokens per day. Running many jobs concurrently may hit these limits.
- **Non-standard frameworks** (e.g. custom build tools, internal package registries, proprietary languages) are outside what Gemini can reliably handle without additional context.
- **Apps requiring runtime secrets** (database URLs, API keys as ENV) will build successfully but may fail at runtime. The agent verifies the image builds and starts — it does not verify application-level health.

### General Edge Cases

- **Repos that expose no port** (batch jobs, CLI tools) will get a Dockerfile without an `EXPOSE` directive. This is correct behavior but the container verification step may show a warning.
- **Multiple Dockerfiles in one repo** — if the repository already contains a Dockerfile, the agent overwrites it with the AI-generated one for the build test. The original is not backed up.
- **Concurrent jobs** each run their own `docker build` in parallel. On a machine with limited CPU/memory, multiple concurrent builds may degrade performance.
- **Windows line endings (CRLF)** in shell scripts inside a repo can cause `RUN` commands to fail with `/bin/sh: bad interpreter` errors. Gemini's fix prompt handles this in retry attempts by adding `dos2unix` or using `sed`.
