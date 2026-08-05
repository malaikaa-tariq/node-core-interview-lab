const fs = require('node:fs');
const path = require('node:path');
const { buildGeneratedRubric } = require('../src/scoringService');

const root = path.join(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data', 'mcq-source.json'), 'utf8'));

const TOPIC_KEYWORDS = {
  'HTTP': ['createserver', 'incomingmessage', 'serverresponse', 'statuscode', 'headers', 'request', 'response'],
  'Runtime & Event Loop': ['event loop', 'callback', 'microtask', 'nexttick', 'timers', 'libuv', 'non-blocking'],
  'File System': ['fs', 'readfile', 'writefile', 'promise', 'rename', 'path', 'error'],
  'Streams & Buffers': ['stream', 'buffer', 'backpressure', 'pipe', 'pipeline', 'readable', 'writable'],
  'Events': ['eventemitter', 'emit', 'listener', 'once', 'error event', 'removelistener'],
  'CommonJS': ['require', 'module.exports', 'module cache', 'wrapper', 'exports'],
  'npm & package.json': ['npm', 'package.json', 'scripts', 'dependencies', 'package-lock', 'semver'],
  'Errors & Process': ['process', 'error', 'exit code', 'uncaughtexception', 'signal', 'stderr']
};

const TOPIC_REQUIREMENTS = {
  'HTTP': ['Request and response objects', 'Headers, status codes, and body flow', 'Failure handling and safe completion'],
  'Runtime & Event Loop': ['Synchronous work versus queued work', 'The relevant queues or event-loop phases', 'Blocking risks and ordering caveats'],
  'File System': ['Asynchronous Node core APIs', 'Error cases and data integrity', 'Safe paths or atomic persistence'],
  'Streams & Buffers': ['Chunked data flow', 'Backpressure and error propagation', 'Correct completion and cleanup'],
  'Events': ['Listener registration and invocation', 'Removal or once semantics', 'Error-event behavior'],
  'CommonJS': ['require and module.exports behavior', 'Caching and module scope', 'A practical refactor or usage example'],
  'npm & package.json': ['Scripts and dependency metadata', 'Repeatable installation', 'Development versus production workflow'],
  'Errors & Process': ['Failure source and observation', 'Safe recovery or shutdown', 'What must not be done in production']
};

const TOPIC_TYPES = {
  'HTTP': 'THEORY',
  'Runtime & Event Loop': 'OUTPUT PREDICTION',
  'File System': 'CODING',
  'Streams & Buffers': 'DEBUGGING',
  'Events': 'IMPLEMENTATION',
  'CommonJS': 'THEORY',
  'npm & package.json': 'SYSTEMS',
  'Errors & Process': 'INCIDENT'
};

const TOPIC_FILES = {
  'HTTP': 'server.js',
  'Runtime & Event Loop': 'event-loop.js',
  'File System': 'store.js',
  'Streams & Buffers': 'stream.js',
  'Events': 'events.js',
  'CommonJS': 'module.js',
  'npm & package.json': 'package.json',
  'Errors & Process': 'process.js',
  'Code Quality': 'review.js',
  'Problem Solving': 'design.js'
};

const GENERIC_CODE = {
  'HTTP': `const http = require('node:http');\n\nhttp.createServer((req, res) => {\n  // Explain the request lifecycle here\n  res.end('ok');\n}).listen(3000);`,
  'Runtime & Event Loop': `console.log('sync');\nsetTimeout(() => console.log('timer'), 0);\nPromise.resolve().then(() => console.log('promise'));\nprocess.nextTick(() => console.log('tick'));`,
  'File System': `const fs = require('node:fs/promises');\n\nasync function updateFile(file) {\n  const value = await fs.readFile(file, 'utf8');\n  // What should happen next?\n}`,
  'Streams & Buffers': `const input = fs.createReadStream(source);\nconst output = fs.createWriteStream(destination);\ninput.on('data', (chunk) => output.write(chunk));`,
  'Events': `const { EventEmitter } = require('node:events');\nconst bus = new EventEmitter();\nbus.on('ready', () => console.log('ready'));\nbus.emit('ready');`,
  'CommonJS': `// config.js\nmodule.exports = { mode: 'production' };\n\n// app.js\nconst config = require('./config');`,
  'npm & package.json': '',
  'Errors & Process': ''
};

const featured = [
  {
    id: 'featured-http-trace', priority: 100, topic: 'HTTP', level: 'intermediate', type: 'THEORY',
    title: 'Trace an HTTP request',
    prompt: 'Explain what happens from the moment this request reaches a Node.js process until the response is sent.',
    codeFile: 'challenge.js',
    code: `POST /users/42?notify=true HTTP/1.1\nHost: localhost:3000\nContent-Type: application/json\nContent-Length: 30\n\n{"name":"Maya","role":"admin"}`,
    requirements: ['How createServer receives it', 'What req and res actually are', 'How to extract method, path, route and query values', 'Why the body is not immediately available', 'At least five failure modes with status codes'],
    rubric: [
      { label: 'createServer request listener', keywords: ['createserver', 'request listener', 'incomingmessage', 'serverresponse'], threshold: 2, weight: 18 },
      { label: 'method URL and query parsing', keywords: ['req.method', 'req.url', 'url', 'searchparams', 'pathname'], threshold: 2, weight: 16 },
      { label: 'streamed request body', keywords: ['data event', 'end event', 'chunks', 'stream', 'json.parse'], threshold: 2, weight: 18 },
      { label: 'response construction', keywords: ['statuscode', 'setheader', 'writehead', 'res.end'], threshold: 2, weight: 15 },
      { label: 'failure handling', keywords: ['400', '404', '405', '413', '500', 'content-type', 'timeout'], threshold: 3, weight: 13 }
    ],
    seniorAnswer: 'http.createServer registers a request listener. For each request Node supplies an IncomingMessage readable stream and a ServerResponse writable response. Read req.method and parse req.url with new URL(req.url, base) to obtain pathname and searchParams. The body arrives asynchronously as chunks through data and end events, so enforce a byte limit before Buffer.concat and JSON.parse. Validate method, route, content type and payload, then set an appropriate status, headers and call res.end exactly once. Typical failures include 400 malformed JSON, 404 route not found, 405 unsupported method, 413 oversized body, 415 unsupported media type and 500 unexpected server failure.'
  },
  {
    id: 'featured-loop-order', priority: 99, topic: 'Runtime & Event Loop', level: 'intermediate', type: 'OUTPUT PREDICTION',
    title: 'Predict the exact order',
    prompt: 'Write the exact output order, then justify every transition between queues and phases.',
    codeFile: 'challenge.js',
    code: `console.log("A");\nsetTimeout(() => console.log("B"), 0);\nsetImmediate(() => console.log("C"));\nPromise.resolve().then(() => console.log("D"));\nprocess.nextTick(() => console.log("E"));\nconsole.log("F");`,
    requirements: ['Give the exact sequence', 'Separate synchronous work from microtasks', 'Explain why timer versus immediate ordering needs qualification'],
    rubric: [
      { label: 'synchronous order A then F', keywords: ['a f', 'a, f', 'a then f', 'synchronous'], threshold: 1, weight: 18 },
      { label: 'nextTick before promise microtask', keywords: ['nexttick', 'e before d', 'nexttick queue', 'promise microtask'], threshold: 2, weight: 22 },
      { label: 'timer and immediate caveat', keywords: ['settimeout', 'setimmediate', 'timers phase', 'check phase', 'non-deterministic', 'context dependent'], threshold: 3, weight: 25 },
      { label: 'complete output', keywords: ['a f e d', 'b c', 'c b'], threshold: 1, weight: 15 }
    ],
    seniorAnswer: 'The guaranteed prefix is A, F, E, D. A and F are synchronous. After the stack clears Node drains process.nextTick before promise microtasks, so E precedes D. The relative order of B and C is not universally guaranteed when both are scheduled from top-level code: setTimeout is handled in the timers phase and setImmediate in the check phase, and timing may determine which becomes ready first. Inside an I/O callback, setImmediate commonly runs first.'
  },
  {
    id: 'featured-fs-atomic', priority: 98, topic: 'File System', level: 'intermediate', type: 'CODING',
    title: 'Atomic JSON persistence',
    prompt: 'Design an async updateStore(file, mutate) function that safely reads, updates, and persists a JSON array.',
    codeFile: 'challenge.js',
    code: `async function updateStore(file, mutate) {\n  // Your implementation\n}`,
    requirements: ['Use only Node core APIs', 'Avoid a partially written destination file', 'Handle missing and corrupt files differently', 'Discuss concurrent callers'],
    rubric: [
      { label: 'fs promises read and parse', keywords: ['fs/promises', 'readfile', 'json.parse', 'enoent'], threshold: 3, weight: 18 },
      { label: 'temporary file then rename', keywords: ['temporary', 'tmp', 'writefile', 'rename', 'atomic'], threshold: 3, weight: 25 },
      { label: 'corrupt data handling', keywords: ['syntaxerror', 'corrupt', 'invalid json', 'backup'], threshold: 1, weight: 14 },
      { label: 'concurrency serialization', keywords: ['queue', 'mutex', 'serialize', 'concurrent', 'race condition'], threshold: 2, weight: 18 },
      { label: 'durability caveat', keywords: ['fsync', 'same directory', 'permissions', 'mode'], threshold: 1, weight: 5 }
    ],
    seniorAnswer: 'Use node:fs/promises to read and parse the array. Treat ENOENT as an empty store, but surface malformed JSON as a corruption error rather than silently replacing it. Apply mutate to a cloned value, write the complete JSON to a uniquely named temporary file in the same directory, optionally sync it for stronger durability, and rename it over the destination. Serialize updates per file with a promise queue so concurrent read-modify-write operations do not overwrite one another.'
  },
  {
    id: 'featured-stream-bugs', priority: 97, topic: 'Streams & Buffers', level: 'advanced', type: 'DEBUGGING',
    title: 'Find the stream bugs',
    prompt: 'This copy utility appears to work. Identify its correctness and resource-management problems, then repair it.',
    codeFile: 'challenge.js',
    code: `const input = fs.createReadStream(src);\nconst output = fs.createWriteStream(dest);\n\ninput.on("data", chunk => output.write(chunk));\ninput.on("end", () => output.end());\ninput.on("error", console.error);`,
    requirements: ['Address backpressure', 'Handle errors on both streams', 'Define when copying is actually complete', 'Prefer the relevant core abstraction'],
    rubric: [
      { label: 'backpressure', keywords: ['backpressure', 'write returns false', 'pause', 'drain'], threshold: 2, weight: 22 },
      { label: 'errors on both sides', keywords: ['input error', 'output error', 'readable error', 'writable error', 'destroy'], threshold: 2, weight: 18 },
      { label: 'pipeline abstraction', keywords: ['pipeline', 'stream/promises', 'await pipeline'], threshold: 2, weight: 25 },
      { label: 'completion semantics', keywords: ['finish', 'close', 'complete', 'await'], threshold: 2, weight: 15 }
    ],
    seniorAnswer: 'Manual data/write wiring ignores backpressure: output.write can return false and the readable should pause until drain. The code also listens only for input errors and treats input end as full copy completion even though the destination may still be flushing. Use await pipeline(createReadStream(src), createWriteStream(dest)) from node:stream/promises. pipeline coordinates backpressure, propagates errors, destroys the chain when necessary and resolves only when the writable has completed.'
  },
  {
    id: 'featured-events-emitter', priority: 96, topic: 'Events', level: 'advanced', type: 'IMPLEMENTATION',
    title: 'Build a minimal EventEmitter',
    prompt: 'Implement on, once, emit and removeListener without using node:events.',
    codeFile: 'challenge.js',
    code: `class TinyEmitter {\n  // Preserve listener order and correct once semantics\n}`,
    requirements: ['Multiple listeners per event', 'Safe removal during emit', 'once must be removable by the original callback', 'Explain the special risk of an unhandled error event'],
    rubric: [
      { label: 'event-to-listener storage', keywords: ['map', 'array', 'listeners', 'event name'], threshold: 2, weight: 18 },
      { label: 'stable emit iteration', keywords: ['copy', 'snapshot', 'slice', 'listener order', 'removal during emit'], threshold: 2, weight: 18 },
      { label: 'once wrapper identity', keywords: ['wrapper', 'original listener', 'once', 'remove'], threshold: 3, weight: 22 },
      { label: 'error event semantics', keywords: ['error event', 'unhandled', 'throw', 'crash'], threshold: 2, weight: 17 },
      { label: 'chainable methods', keywords: ['return this', 'chain'], threshold: 1, weight: 5 }
    ],
    seniorAnswer: 'Store listeners in a Map from event name to arrays. on appends and returns this. emit should iterate a shallow copy so listeners may add or remove handlers without corrupting the active iteration. once should install a wrapper that removes itself before invoking the original function, while retaining a reference to the original so removeListener(original) can find it. If error is emitted without an error listener, mirror Node by throwing because silent infrastructure errors are unsafe.'
  },
  {
    id: 'featured-commonjs-cycle', priority: 95, topic: 'CommonJS', level: 'advanced', type: 'THEORY',
    title: 'Exports and circular loading',
    prompt: 'Explain the output and the underlying module state. Then show one refactor that removes the fragile cycle.',
    codeFile: 'challenge.js',
    code: `// a.js\nexports.ready = false;\nconst b = require('./b');\nexports.ready = true;\n\n// b.js\nconst a = require('./a');\nconsole.log(a.ready);`,
    requirements: ['Module wrapper', 'Cache insertion timing', 'Partial exports', 'module.exports versus rebinding exports'],
    rubric: [
      { label: 'partial export false', keywords: ['false', 'partial exports', 'partially initialized'], threshold: 2, weight: 20 },
      { label: 'cache before completion', keywords: ['cache', 'before execution completes', 'circular', 'require'], threshold: 3, weight: 22 },
      { label: 'module wrapper and scope', keywords: ['module wrapper', 'exports', 'module.exports', 'local scope'], threshold: 2, weight: 15 },
      { label: 'refactor cycle', keywords: ['dependency injection', 'third module', 'shared module', 'invert', 'remove cycle'], threshold: 1, weight: 18 },
      { label: 'exports rebinding caveat', keywords: ['exports =', 'rebind', 'module.exports'], threshold: 2, weight: 5 }
    ],
    seniorAnswer: 'b logs false. CommonJS creates a module object, places it in the require cache before evaluation completes, and then executes the wrapped module function. During the cycle b receives a reference to a partially initialized exports object from a, where ready is still false. Rebinding exports alone would not replace module.exports. Remove the cycle by extracting shared state into a third module, passing dependencies into constructors or functions, or moving orchestration into a higher-level module.'
  },
  {
    id: 'featured-npm-ci', priority: 94, topic: 'npm & package.json', level: 'intermediate', type: 'SYSTEMS',
    title: 'Make CI reproducible',
    prompt: 'Review a project that uses npm install in CI, commits package.json, but ignores package-lock.json. Explain the risks and propose a corrected workflow.',
    codeFile: 'package.json', code: '',
    requirements: ['SemVer ranges', 'Lockfile purpose', 'npm install versus npm ci', 'dependencies versus devDependencies', 'Module resolution'],
    rubric: [
      { label: 'semver range risk', keywords: ['semver', 'range', 'different versions', 'non-reproducible'], threshold: 2, weight: 18 },
      { label: 'commit lockfile', keywords: ['package-lock.json', 'commit', 'exact dependency tree', 'integrity'], threshold: 2, weight: 22 },
      { label: 'npm ci behavior', keywords: ['npm ci', 'clean install', 'fails', 'lockfile'], threshold: 2, weight: 22 },
      { label: 'dependency classification', keywords: ['dependencies', 'devdependencies', 'production', 'build tools'], threshold: 2, weight: 13 },
      { label: 'Node version control', keywords: ['node version', 'engines', '.nvmrc', 'volta'], threshold: 1, weight: 5 }
    ],
    seniorAnswer: 'SemVer ranges allow npm install to resolve newer transitive versions over time, so two CI runs can produce different trees. Commit package-lock.json and use npm ci, which removes node_modules, installs exactly from the lockfile and fails when package.json and the lock disagree. Put runtime packages in dependencies and test/build tooling in devDependencies. Pin or declare the Node version as well so the runtime and dependency tree are both reproducible.'
  },
  {
    id: 'featured-debug-latency', priority: 93, topic: 'Errors & Process', level: 'advanced', type: 'INCIDENT',
    title: 'Diagnose event-loop latency',
    prompt: 'An API has low CPU on average but sporadic four-second latency spikes while processing uploaded JSON. Give a disciplined diagnosis and remediation plan.',
    codeFile: 'incident.txt', code: '',
    requirements: ['Name likely event-loop blockers', 'Choose measurements', 'Separate memory pressure from CPU blocking', 'Propose bounded core-only fixes'],
    rubric: [
      { label: 'likely blockers', keywords: ['json.parse', 'large payload', 'synchronous', 'regex', 'gc', 'event loop'], threshold: 3, weight: 22 },
      { label: 'measure event-loop delay', keywords: ['monitorEventLoopDelay', 'perf_hooks', 'event loop utilization', 'diagnostic report'], threshold: 2, weight: 23 },
      { label: 'memory and GC separation', keywords: ['heap', 'rss', 'gc', 'memory pressure', 'cpu profile'], threshold: 2, weight: 15 },
      { label: 'bounded remediation', keywords: ['body limit', 'stream', 'worker thread', 'backpressure', 'timeout', 'queue'], threshold: 3, weight: 20 }
    ],
    seniorAnswer: 'Suspect synchronous JSON.parse or stringify of large payloads, other sync APIs, pathological validation, memory pressure and long garbage-collection pauses. Correlate request size and latency with perf_hooks.monitorEventLoopDelay, eventLoopUtilization, heap/RSS metrics, CPU profiles and diagnostic reports. Enforce upload limits and timeouts, stream or incrementally process data where the format permits, bound concurrent parsing, and move genuinely CPU-heavy parsing or validation to worker_threads. Do not hide the issue by simply raising timeouts.'
  },
  {
    id: 'featured-quality-route', priority: 92, topic: 'Code Quality', level: 'intermediate', type: 'CODE REVIEW',
    title: 'Review a core HTTP route',
    prompt: 'Identify maintainability and correctness problems in this route handler, then outline a cleaner CommonJS design.',
    codeFile: 'server.js',
    code: `if (req.url === '/users' && req.method === 'POST') {\n  let body = '';\n  req.on('data', c => body += c);\n  req.on('end', () => {\n    const user = JSON.parse(body);\n    fs.writeFileSync('users.json', JSON.stringify(user));\n    res.end('done');\n  });\n}`,
    requirements: ['Input limits and validation', 'Asynchronous persistence', 'Error and response consistency', 'Separation into focused CommonJS modules'],
    rubric: [
      { label: 'bounded body parsing', keywords: ['body limit', '413', 'content-type', 'validation', 'json.parse error'], threshold: 2, weight: 20 },
      { label: 'non-blocking file access', keywords: ['writefilesync', 'blocking', 'fs/promises', 'atomic'], threshold: 2, weight: 20 },
      { label: 'consistent HTTP errors', keywords: ['status code', '400', '500', 'headers', 'res.end once'], threshold: 2, weight: 18 },
      { label: 'module separation', keywords: ['router', 'service', 'repository', 'module.exports', 'single responsibility'], threshold: 2, weight: 17 },
      { label: 'concurrency correctness', keywords: ['race', 'queue', 'overwrite', 'concurrent'], threshold: 1, weight: 5 }
    ],
    seniorAnswer: 'The handler has no body-size or content-type guard, JSON.parse can throw, writeFileSync blocks the event loop, and the write overwrites the entire store with no concurrency control. Extract body parsing and validation, route dispatch, user service and file repository into focused CommonJS modules. Use fs/promises with an atomic queued update, centralize JSON responses and errors, set explicit status codes and ensure every request completes exactly once.'
  },
  {
    id: 'featured-problem-queue', priority: 91, topic: 'Problem Solving', level: 'advanced', type: 'SYSTEM DESIGN',
    title: 'Design a bounded job runner',
    prompt: 'Design a Node.js core-only job runner that accepts tasks, runs at most four concurrently, supports cancellation, and shuts down gracefully.',
    codeFile: 'runner.js', code: '',
    requirements: ['Queue and concurrency invariant', 'Cancellation and timeout behavior', 'EventEmitter observability', 'Graceful SIGTERM shutdown'],
    rubric: [
      { label: 'bounded concurrency queue', keywords: ['queue', 'active count', 'four', 'concurrency', 'dispatch'], threshold: 3, weight: 22 },
      { label: 'cancellation and timeout', keywords: ['abortcontroller', 'abortsignal', 'timeout', 'cancel'], threshold: 2, weight: 18 },
      { label: 'events and state', keywords: ['eventemitter', 'started', 'completed', 'failed', 'id'], threshold: 2, weight: 16 },
      { label: 'graceful shutdown', keywords: ['sigterm', 'stop accepting', 'drain', 'server.close', 'force timeout'], threshold: 3, weight: 20 },
      { label: 'error isolation', keywords: ['try catch', 'promise rejection', 'finally', 'continue queue'], threshold: 2, weight: 4 }
    ],
    seniorAnswer: 'Maintain a FIFO queue and an active counter; dispatch while active is below four. Give every task an ID and AbortController, combine caller cancellation with a timeout, and decrement active in finally before scheduling more work. Emit queued, started, completed, failed and cancelled events through EventEmitter. On SIGTERM stop accepting work, cancel queued tasks or preserve them according to policy, await active tasks for a bounded grace period, then force termination with a non-zero exit code if they do not finish.'
  }
];

const supplementary = [
  ['quality-beginner-1', 'Code Quality', 'beginner', 'CODE REVIEW', 'Name code that explains itself', 'A Node.js file contains one 300-line request callback. Explain how you would split it without introducing a framework.', ['Single responsibility', 'Descriptive CommonJS modules', 'Small pure functions', 'Clear error paths'], ['single responsibility', 'module', 'function', 'router', 'service', 'error']],
  ['quality-beginner-2', 'Code Quality', 'beginner', 'CODE REVIEW', 'Remove duplicated response code', 'Several routes repeat writeHead, JSON.stringify and res.end. Design a small reusable response helper.', ['Correct content type', 'Content length or chunked response', 'Status code input', 'Exactly one res.end'], ['writehead', 'content-type', 'json.stringify', 'status code', 'res.end']],
  ['quality-intermediate-1', 'Code Quality', 'intermediate', 'TESTING', 'Test without Express', 'Explain how node:test can verify a core HTTP server and its JSON API.', ['Start on an ephemeral port', 'Send a real HTTP request', 'Assert status, headers and body', 'Close the server reliably'], ['node:test', 'assert', 'port 0', 'http.request', 'fetch', 'server.close']],
  ['quality-intermediate-2', 'Code Quality', 'intermediate', 'REFACTOR', 'Separate routing from transport', 'Propose a CommonJS structure that keeps URL matching, business rules and file persistence independently testable.', ['Router responsibilities', 'Service responsibilities', 'Repository responsibilities', 'Dependency direction'], ['router', 'service', 'repository', 'module.exports', 'dependency injection']],
  ['quality-advanced-1', 'Code Quality', 'advanced', 'RELIABILITY', 'Make errors observable', 'Design structured core-only request logging with correlation IDs and safe error serialization.', ['Request ID generation', 'Timing and status', 'Redaction', 'stderr and exit behavior'], ['crypto.randomuuid', 'request id', 'duration', 'stderr', 'redact', 'json']],
  ['problem-beginner-1', 'Problem Solving', 'beginner', 'ALGORITHM', 'Route lookup without Express', 'Design a simple route table for method and pathname matching using only Node.js core.', ['Route representation', 'Exact method/path matching', 'Parameters or query handling', '404 and 405 distinction'], ['array', 'map', 'method', 'pathname', '404', '405']],
  ['problem-beginner-2', 'Problem Solving', 'beginner', 'ALGORITHM', 'Count events safely', 'A server must count requests by status code and save the totals. Describe a simple design.', ['In-memory data shape', 'Update timing', 'Async persistence', 'Restart behavior'], ['map', 'object', 'status code', 'event', 'writefile', 'json']],
  ['problem-intermediate-1', 'Problem Solving', 'intermediate', 'DESIGN', 'Build a retry helper', 'Design an async retry helper with exponential backoff and a maximum attempt count.', ['Retryable versus permanent errors', 'Backoff calculation', 'Jitter', 'AbortSignal support'], ['attempt', 'exponential backoff', 'jitter', 'abortsignal', 'retryable']],
  ['problem-intermediate-2', 'Problem Solving', 'intermediate', 'DESIGN', 'Deduplicate concurrent reads', 'Multiple requests ask for the same file at once. Design a promise-based in-flight cache.', ['Cache key', 'Store the pending promise', 'Remove after settle', 'Do not cache permanent failures blindly'], ['map', 'promise', 'in-flight', 'finally', 'cache', 'error']],
  ['problem-advanced-1', 'Problem Solving', 'advanced', 'SYSTEM DESIGN', 'Stream a large export', 'Design a CSV export endpoint for millions of records without holding the full file in memory.', ['Readable generation', 'Backpressure', 'Headers and errors', 'Client disconnect cleanup'], ['readable', 'stream', 'backpressure', 'drain', 'content-disposition', 'close', 'destroy']]
].map(([id, topic, level, type, title, prompt, requirements, keywords]) => ({
  id,
  topic,
  level,
  type,
  title,
  prompt,
  codeFile: TOPIC_FILES[topic],
  code: '',
  requirements,
  rubric: [
    { label: requirements[0], keywords: keywords.slice(0, 2), threshold: 1, weight: 20 },
    { label: requirements[1], keywords: keywords.slice(2, 4), threshold: 1, weight: 20 },
    { label: requirements[2], keywords: keywords.slice(4), threshold: 1, weight: 20 },
    { label: requirements[3], keywords, threshold: Math.min(3, keywords.length), weight: 20 }
  ],
  seniorAnswer: `A strong response should explicitly cover ${requirements.join(', ').toLowerCase()}. It should explain the invariant, show how Node.js core APIs enforce it, identify failure paths, and state how the design remains testable and non-blocking.`
}));

function shortenTitle(prompt) {
  const text = prompt.replace(/[?]$/, '').replace(/^(What|Which|Why|How|When)\s+/i, '');
  return text.length <= 58 ? text : `${text.slice(0, 55).trim()}…`;
}

const generated = source.map((question, index) => {
  const correctOption = question.options[question.answer];
  const topicKeywords = TOPIC_KEYWORDS[question.topic] || [];
  const levelPrompt = question.level === 'advanced'
    ? 'Give a precise runtime-level explanation, including important caveats.'
    : question.level === 'intermediate'
      ? 'Explain the correct behavior and connect it to a practical Node.js application.'
      : 'Explain the concept in clear language and give one small example.';
  return {
    id: `open-${String(index + 1).padStart(3, '0')}`,
    priority: 0,
    topic: question.topic,
    level: question.level,
    type: TOPIC_TYPES[question.topic] || 'THEORY',
    title: shortenTitle(question.prompt),
    prompt: `${question.prompt} ${levelPrompt}`,
    codeFile: TOPIC_FILES[question.topic] || 'challenge.js',
    code: (question.level === 'beginner' && ['npm & package.json', 'Errors & Process'].includes(question.topic)) ? '' : (GENERIC_CODE[question.topic] || ''),
    requirements: TOPIC_REQUIREMENTS[question.topic] || ['Correct behavior', 'Underlying mechanism', 'Practical example'],
    rubric: buildGeneratedRubric(correctOption, question.explanation, topicKeywords),
    seniorAnswer: `${correctOption}. ${question.explanation}`
  };
});

const questions = [...featured, ...supplementary, ...generated];
fs.writeFileSync(path.join(root, 'data', 'questions.json'), `${JSON.stringify(questions, null, 2)}\n`);
console.log(`Generated ${questions.length} interview questions.`);
