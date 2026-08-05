const fs = require('node:fs/promises');
const path = require('node:path');

const queues = new Map();

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(fallback);
    throw error;
  }
}

function queueWrite(filePath, operation) {
  const previous = queues.get(filePath) || Promise.resolve();
  const next = previous.then(operation, operation);
  const tracked = next.finally(() => {
    if (queues.get(filePath) === tracked) queues.delete(filePath);
  });
  queues.set(filePath, tracked);
  return tracked;
}

async function writeJson(filePath, value) {
  return queueWrite(filePath, async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, filePath);
    return value;
  });
}

async function updateJson(filePath, fallback, updater) {
  return queueWrite(filePath, async () => {
    const current = await readJson(filePath, fallback);
    const updated = await updater(current);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, filePath);
    return updated;
  });
}

module.exports = { readJson, writeJson, updateJson };
