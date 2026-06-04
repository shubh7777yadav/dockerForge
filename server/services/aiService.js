const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Gemini sometimes wraps output in ```dockerfile ... ``` even when asked not to
function stripCodeFences(text) {
  return text.replace(/^```[\w]*\n?/i, '').replace(/\n?```$/i, '').trim();
}

async function generateDockerfile({ fileList, keyFiles, repoPath }) {
  const keyFileSummary = Object.entries(keyFiles)
    .map(([name, content]) => `=== ${name} ===\n${content}`)
    .join('\n\n');

  const prompt = `You are a Docker expert. Analyze the following repository structure and key files, then generate a production-ready Dockerfile that will build and run successfully.

## File Structure (top-level):
${fileList.slice(0, 80).join('\n')}

## Key Configuration Files:
${keyFileSummary}

## Rules:
- Output ONLY the raw Dockerfile content, no markdown, no explanation, no code fences
- Use multi-stage builds where appropriate
- Pin specific stable base image versions (e.g. node:20-alpine, python:3.11-slim)
- Set WORKDIR, copy files, install dependencies, expose port, and define CMD/ENTRYPOINT
- Handle both development and production correctly
- If it's a Node.js app detect if it uses next/vite/react-scripts and set build + start correctly
- If Python, detect Django/Flask/FastAPI and use gunicorn or uvicorn appropriately
- Always expose the correct port and set ENV variables needed
`;

  const result = await model.generateContent(prompt);
  return stripCodeFences(result.response.text());
}

async function fixDockerfile({ dockerfile, errorLog, fileList, keyFiles }) {
  const prompt = `You are a Docker expert. The following Dockerfile failed to build. Analyze the error and return a fixed Dockerfile.

## Failed Dockerfile:
${dockerfile}

## Build Error:
${errorLog.slice(-3000)}

## File Structure:
${fileList.slice(0, 60).join('\n')}

## Key Files:
${Object.entries(keyFiles)
  .map(([n, c]) => `=== ${n} ===\n${c}`)
  .join('\n\n')
  .slice(0, 3000)}

## Rules:
- Output ONLY the raw Dockerfile content, no markdown, no explanation, no code fences
- Fix the exact error shown above
- Keep working parts of the original Dockerfile
- Ensure the container will start correctly after build
`;

  const result = await model.generateContent(prompt);
  return stripCodeFences(result.response.text());
}

module.exports = { generateDockerfile, fixDockerfile };
