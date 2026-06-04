const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true },
    repoUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'cloning', 'analyzing', 'generating', 'building', 'success', 'failed'],
      default: 'pending'
    },
    dockerfile: { type: String, default: '' },
    logs: [{ type: String }],
    attempts: { type: Number, default: 0 },
    error: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', jobSchema);
