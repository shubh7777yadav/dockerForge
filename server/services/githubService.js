const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLONE_BASE = path.join(os.tmpdir(), 'dockerfile-agent-repos');

function ensureBase() {
  if (!fs.existsSync(CLONE_BASE)) fs.mkdirSync(CLONE_BASE, { recursive: true });
}

async function cloneRepo(repoUrl, jobId) {
  ensureBase();
  const dest = path.join(CLONE_BASE, jobId);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  const git = simpleGit();
  await git.clone(repoUrl, dest, ['--depth', '1']);
  return dest;
}

function scanDirectory(dirPath, depth = 0, maxDepth = 4) {
  const result = [];
  if (depth > maxDepth) return result;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', 'venv', '.venv'].includes(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push({ type: 'dir', name: entry.name, children: scanDirectory(fullPath, depth + 1, maxDepth) });
    } else {
      result.push({ type: 'file', name: entry.name });
    }
  }
  return result;
}

function readKeyFiles(repoPath) {
  const keyFiles = [
    'package.json', 'package-lock.json', 'yarn.lock',
    'requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py',
    'pom.xml', 'build.gradle', 'build.gradle.kts',
    'go.mod', 'go.sum', 'Cargo.toml',
    'composer.json', 'Gemfile',
    '.nvmrc', '.node-version', 'runtime.txt',
    'Procfile', 'app.json', 'next.config.js',
    'vite.config.js', 'vite.config.ts', 'tsconfig.json'
  ];
  const contents = {};
  for (const file of keyFiles) {
    const filePath = path.join(repoPath, file);
    if (fs.existsSync(filePath)) {
      try {
        contents[file] = fs.readFileSync(filePath, 'utf-8').slice(0, 3000);
      } catch {
        contents[file] = '';
      }
    }
  }
  return contents;
}

function flatFileList(structure, prefix = '') {
  const files = [];
  for (const item of structure) {
    const p = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.type === 'file') files.push(p);
    else if (item.type === 'dir' && item.children) files.push(...flatFileList(item.children, p));
  }
  return files;
}

module.exports = { cloneRepo, scanDirectory, readKeyFiles, flatFileList };
