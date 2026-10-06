const crypto = require('crypto');

// Minimal in-memory job queue: run work in the background, poll for status.
// (Swap for BullMQ/Redis if you need persistence or multiple workers.)
const jobs = new Map();
const MAX_JOBS = 100;

function submit(label, work, ownerId) {
  const id = crypto.randomUUID();
  const job = { id, label, ownerId, status: 'queued', createdAt: new Date().toISOString(), result: null, error: null };
  jobs.set(id, job);
  if (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value);
  setImmediate(async () => {
    job.status = 'running';
    try { job.result = await work(); job.status = 'done'; }
    catch (e) { job.error = e.message; job.status = 'failed'; }
    job.finishedAt = new Date().toISOString();
  });
  return job;
}
const get = (id, ownerId) => {
  const job = jobs.get(id);
  return job?.ownerId === ownerId ? job : undefined;
};

module.exports = { submit, get };
