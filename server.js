const http = require('node:http');
const path = require('node:path');
const { updateJson } = require('./src/fileStore');
const { route } = require('./src/router');

const PORT = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
const HOST = process.env.HOST || '0.0.0.0';
const METRICS_FILE = path.join(__dirname, 'data', 'metrics.json');

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  updateJson(METRICS_FILE, {
    requests: 0,
    interviewsStarted: 0,
    answersScored: 0,
    interviewsCompleted: 0
  }, (metrics) => {
    metrics.requests = (metrics.requests || 0) + 1;
    return metrics;
  }).catch((error) => console.error('Metrics update failed:', error.message));

  try {
    await route(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      const statusCode = error.statusCode || 500;
      const message = statusCode === 500 ? 'Internal server error.' : error.message;
      const body = JSON.stringify({ error: message });
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      });
      res.end(body);
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  console.log(`NODE/CORE Interview Lab: http://localhost:${address.port}`);
  console.log('Node.js core only — no Express and no runtime dependencies.');
});

function shutdown(signal) {
  console.log(`\n${signal} received. Closing HTTP server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
