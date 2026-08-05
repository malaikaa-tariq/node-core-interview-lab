const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const { Readable } = require('node:stream');
const { getMimeType } = require('./mimeTypes');
const questionService = require('./questionService');
const resultService = require('./resultService');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const GUIDE_FILE = path.join(__dirname, '..', 'data', 'study-guide.txt');
const MAX_BODY_BYTES = 1_000_000;

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        const error = new Error('Request body is too large.');
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        const error = new Error('Request body must contain valid JSON.');
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

async function serveStatic(pathname, req, res) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(PUBLIC_DIR, `.${requested}`);
  const relative = path.relative(PUBLIC_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;

  try {
    const stat = await fsp.stat(resolved);
    if (!stat.isFile()) return false;
    const headers = {
      'Content-Type': getMimeType(path.extname(resolved)),
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(resolved).pipe(res);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function streamStudyGuide(res) {
  const stat = await fsp.stat(GUIDE_FILE);
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': stat.size,
    'Content-Disposition': 'attachment; filename="node-core-study-guide.txt"'
  });
  fs.createReadStream(GUIDE_FILE).pipe(res);
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/meta') {
    const metadata = await questionService.getMetadata();
    return json(res, 200, {
      ...metadata,
      server: {
        online: true,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
        express: false,
        modules: ['http', 'fs', 'stream', 'events', 'url', 'path', 'crypto']
      }
    });
  }

  if (req.method === 'GET' && pathname === '/api/runtime-demo') {
    const order = ['sync:start'];
    process.nextTick(() => order.push('nextTick'));
    Promise.resolve().then(() => order.push('promise'));
    setImmediate(() => {
      order.push('setImmediate');
      json(res, 200, { order, explanation: 'Synchronous work runs first, followed by nextTick and promise microtasks before the check-phase callback.' });
    });
    order.push('sync:end');
    return;
  }

  if (req.method === 'POST' && pathname === '/api/interviews/start') {
    const interview = await questionService.startInterview(await readBody(req));
    return json(res, 201, interview);
  }

  if (req.method === 'POST' && pathname === '/api/interviews/answer') {
    const feedback = await resultService.scoreAnswer(await readBody(req));
    return json(res, 200, feedback);
  }

  if (req.method === 'POST' && pathname === '/api/interviews/complete') {
    const result = await resultService.completeInterview(await readBody(req));
    return json(res, 200, result);
  }

  if (req.method === 'GET' && pathname === '/api/results') {
    const learnerId = url.searchParams.get('learnerId');
    if (!learnerId) return json(res, 400, { error: 'learnerId is required.' });
    return json(res, 200, await resultService.getResults(learnerId));
  }

  const reportMatch = pathname.match(/^\/api\/results\/([^/]+)\/report$/);
  if (req.method === 'GET' && reportMatch) {
    const result = await resultService.getResult(decodeURIComponent(reportMatch[1]));
    if (!result) return json(res, 404, { error: 'Result not found.' });
    const report = resultService.formatReport(result);
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="node-core-report-${result.id.slice(0, 8)}.txt"`
    });
    return Readable.from(report).pipe(res);
  }

  if (req.method === 'POST' && pathname === '/api/progress/reset') {
    const body = await readBody(req);
    if (!body.learnerId) return json(res, 400, { error: 'learnerId is required.' });
    await questionService.resetHistory(body.learnerId);
    return json(res, 200, { message: 'Question history reset. The next interview starts a fresh cycle.' });
  }

  if (req.method === 'GET' && pathname === '/api/study-guide') {
    return streamStudyGuide(res);
  }

  if (pathname.startsWith('/api/')) return json(res, 404, { error: 'API endpoint not found.' });
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });

  const served = await serveStatic(pathname, req, res);
  if (!served) json(res, 404, { error: 'Page not found.' });
}

module.exports = { route };
