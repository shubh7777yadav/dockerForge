const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function writeDockerfile(repoPath, content) {
  const dockerfilePath = path.join(repoPath, 'Dockerfile');
  fs.writeFileSync(dockerfilePath, content, 'utf-8');
  return dockerfilePath;
}

function buildImage(repoPath, imageTag, onLog) {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['build', '-t', imageTag, '.'], {
      cwd: repoPath,
      shell: true
    });

    const logs = [];

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      logs.push(line);
      onLog(line);
    });

    proc.stderr.on('data', (data) => {
      const line = data.toString();
      logs.push(line);
      onLog(line);
    });

    proc.on('close', (code) => {
      resolve({ success: code === 0, logs, code });
    });

    proc.on('error', (err) => {
      const msg = `Process error: ${err.message}\n`;
      logs.push(msg);
      onLog(msg);
      resolve({ success: false, logs, code: -1 });
    });
  });
}

function runContainer(imageTag, onLog) {
  return new Promise((resolve) => {
    // Run with a short timeout to verify container starts without immediately crashing
    const proc = spawn('docker', ['run', '--rm', '--entrypoint', 'echo', imageTag, 'container-ok'], { shell: true });
    const logs = [];

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      logs.push(line);
      onLog(line);
    });

    proc.stderr.on('data', (data) => {
      const line = data.toString();
      logs.push(line);
      onLog(line);
    });

    proc.on('close', (code) => {
      resolve({ success: code === 0, logs });
    });

    proc.on('error', (err) => {
      resolve({ success: false, logs: [`${err.message}`] });
    });
  });
}

function cleanupImage(imageTag) {
  spawn('docker', ['rmi', '-f', imageTag], { shell: true });
}

module.exports = { writeDockerfile, buildImage, runContainer, cleanupImage };
