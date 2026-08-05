const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const queues = new Map();

const MUTABLE_FILES = new Set([
  'progress.json',
  'results.json',
  'metrics.json',
  'activity.json'
]);

function resolveStoragePath(filePath) {
  const isVercel = Boolean(process.env.VERCEL);
  const fileName = path.basename(filePath);

  if (isVercel && MUTABLE_FILES.has(fileName)) {
    return path.join(os.tmpdir(), 'node-core-interview-lab', fileName);
  }

  return filePath;
}

async function readJson(filePath, fallback) {
  const resolvedPath = resolveStoragePath(filePath);

  try {
    return JSON.parse(await fs.readFile(resolvedPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return structuredClone(fallback);
    }

    throw error;
  }
}

function queueWrite(filePath, operation) {
  const previous = queues.get(filePath) || Promise.resolve();
  const next = previous.then(operation, operation);

  const tracked = next.finally(() => {
    if (queues.get(filePath) === tracked) {
      queues.delete(filePath);
    }
  });

  queues.set(filePath, tracked);
  return tracked;
}

async function writeJson(filePath, value) {
  const resolvedPath = resolveStoragePath(filePath);

  return queueWrite(resolvedPath, async () => {
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    const temporaryPath =
      `${resolvedPath}.${process.pid}.${Date.now()}.tmp`;

    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      'utf8'
    );

    await fs.rename(temporaryPath, resolvedPath);
    return value;
  });
}

async function updateJson(filePath, fallback, updater) {
  const resolvedPath = resolveStoragePath(filePath);

  return queueWrite(resolvedPath, async () => {
    const current = await readJson(filePath, fallback);
    const updated = await updater(current);

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    const temporaryPath =
      `${resolvedPath}.${process.pid}.${Date.now()}.tmp`;

    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(updated, null, 2)}\n`,
      'utf8'
    );

    await fs.rename(temporaryPath, resolvedPath);
    return updated;
  });
}

module.exports = {
  readJson,
  writeJson,
  updateJson
};
