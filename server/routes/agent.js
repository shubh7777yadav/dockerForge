const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Job = require('../models/Job');
const { cloneRepo, scanDirectory, readKeyFiles, flatFileList } = require('../services/githubService');
const { generateDockerfile, fixDockerfile } = require('../services/aiService');
const { writeDockerfile, buildImage, runContainer, cleanupImage } = require('../services/dockerService');

const MAX_ATTEMPTS = 3;

// POST /api/agent/start
router.post('/start', async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });

  const jobId = uuidv4();
  await Job.create({ jobId, repoUrl, status: 'pending' });
  res.json({ jobId });

  // Run agent asynchronously
  runAgent(jobId, repoUrl, req.io).catch(console.error);
});

// GET /api/agent/job/:jobId
router.get('/job/:jobId', async (req, res) => {
  const job = await Job.findOne({ jobId: req.params.jobId });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

async function emit(io, jobId, event, data) {
  io.emit(`job:${jobId}`, { event, data });
}

async function updateJob(jobId, fields) {
  await Job.findOneAndUpdate({ jobId }, { $set: fields });
}

async function appendLog(io, jobId, message) {
  await Job.findOneAndUpdate({ jobId }, { $push: { logs: message } });
  await emit(io, jobId, 'log', message);
}

async function runAgent(jobId, repoUrl, io) {
  try {
    // Step 1: Clone
    await updateJob(jobId, { status: 'cloning' });
    await emit(io, jobId, 'status', 'cloning');
    await appendLog(io, jobId, `Cloning repository: ${repoUrl}`);

    let repoPath;
    try {
      repoPath = await cloneRepo(repoUrl, jobId);
    } catch (err) {
      await appendLog(io, jobId, `Clone failed: ${err.message}`);
      await updateJob(jobId, { status: 'failed', error: err.message });
      await emit(io, jobId, 'status', 'failed');
      return;
    }
    await appendLog(io, jobId, `Repository cloned to ${repoPath}`);

    // Step 2: Analyze
    await updateJob(jobId, { status: 'analyzing' });
    await emit(io, jobId, 'status', 'analyzing');
    await appendLog(io, jobId, 'Scanning file structure...');

    const structure = scanDirectory(repoPath);
    const fileList = flatFileList(structure);
    const keyFiles = readKeyFiles(repoPath);

    await appendLog(io, jobId, `Found ${fileList.length} files. Key config files: ${Object.keys(keyFiles).join(', ') || 'none'}`);

    // Step 3: Generate Dockerfile
    await updateJob(jobId, { status: 'generating' });
    await emit(io, jobId, 'status', 'generating');
    await appendLog(io, jobId, 'Generating Dockerfile with AI...');

    let dockerfile = await generateDockerfile({ fileList, keyFiles, repoPath });
    await updateJob(jobId, { dockerfile });
    await emit(io, jobId, 'dockerfile', dockerfile);
    await appendLog(io, jobId, 'Dockerfile generated.');

    // Step 4 & 5: Build with retry loop
    await updateJob(jobId, { status: 'building' });
    await emit(io, jobId, 'status', 'building');

    const imageTag = `dockerfile-agent-${jobId.slice(0, 8)}`.toLowerCase();
    let buildSuccess = false;
    let lastError = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await updateJob(jobId, { attempts: attempt });
      await appendLog(io, jobId, `\n--- Build Attempt ${attempt}/${MAX_ATTEMPTS} ---`);

      writeDockerfile(repoPath, dockerfile);

      const buildResult = await buildImage(repoPath, imageTag, (line) => {
        appendLog(io, jobId, line.trimEnd());
      });

      if (buildResult.success) {
        buildSuccess = true;
        await appendLog(io, jobId, '\nBuild succeeded! Starting container verification...');

        const runResult = await runContainer(imageTag, (line) => {
          appendLog(io, jobId, line.trimEnd());
        });

        if (runResult.success) {
          await appendLog(io, jobId, 'Container started successfully!');
        } else {
          await appendLog(io, jobId, 'Warning: Container run check had issues, but image built successfully.');
        }

        cleanupImage(imageTag);
        break;
      } else {
        lastError = buildResult.logs.join('');
        await appendLog(io, jobId, `\nBuild failed on attempt ${attempt}.`);

        if (attempt < MAX_ATTEMPTS) {
          await appendLog(io, jobId, 'Asking AI to fix the Dockerfile...');
          await updateJob(jobId, { status: 'generating' });
          await emit(io, jobId, 'status', 'generating');

          dockerfile = await fixDockerfile({ dockerfile, errorLog: lastError, fileList, keyFiles });
          await updateJob(jobId, { dockerfile });
          await emit(io, jobId, 'dockerfile', dockerfile);
          await appendLog(io, jobId, 'Dockerfile updated. Retrying build...');

          await updateJob(jobId, { status: 'building' });
          await emit(io, jobId, 'status', 'building');
        }
      }
    }

    if (buildSuccess) {
      await updateJob(jobId, { status: 'success' });
      await emit(io, jobId, 'status', 'success');
      await appendLog(io, jobId, '\nAgent completed successfully!');
    } else {
      await updateJob(jobId, { status: 'failed', error: lastError.slice(-1000) });
      await emit(io, jobId, 'status', 'failed');
      await appendLog(io, jobId, `\nAll ${MAX_ATTEMPTS} attempts failed.`);
    }
  } catch (err) {
    console.error('Agent error:', err);
    await updateJob(jobId, { status: 'failed', error: err.message });
    await emit(io, jobId, 'status', 'failed');
    await appendLog(io, jobId, `Unexpected error: ${err.message}`);
  }
}

module.exports = router;
