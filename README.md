# NODE/CORE Interview Lab

**NODE/CORE** is a working Node.js core assessment application for beginners, students, interview candidates, and professionals. It presents one written technical challenge at a time, scores the response against a transparent rubric, identifies missing concepts, reveals a senior-level answer, and produces a downloadable report.

The backend uses **Node.js core modules only**. There is no Express and there are no runtime dependencies.

## Run the project

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000
```

When PowerShell already displays a path ending in `node-core-interview-lab>`, do not run `cd node-core-interview-lab` again.

## Main features

- Screenshot-inspired cream, black, and neon-green interview interface
- Foundation, Practitioner, Senior, and Adaptive levels
- 5-question quick check, 8-question deep dive, or 10-question full map
- 100 Node.js technical challenges
- Written explanations instead of repeated multiple-choice questions
- Code-reading, output-prediction, debugging, implementation, systems, and incident questions
- Non-repeating question memory stored per learner
- Unseen questions are selected before any question becomes available again
- Balanced topic selection across ten skill dimensions
- Word counter and browser autosave for unfinished responses
- `Ctrl + Enter` answer submission
- Rubric-based server scoring without external AI services
- Missing-concept feedback and senior-level answer reveal
- Final score ring, topic breakdown, full review, and past-result history
- Streamed study guide and streamed text report download
- Responsive desktop, tablet, and mobile layouts

## Assignment requirement mapping

| Requirement | Implementation |
|---|---|
| Basic HTTP server | `http.createServer()` in `server.js` |
| No Express | No Express import and no runtime dependencies |
| CommonJS modules | `require()` and `module.exports` throughout `src/` |
| File system | Questions, progress, results, metrics, and activity stored with `fs` / `fs.promises` |
| Streams | Static assets and study guide use `fs.createReadStream()`; reports use `Readable.from()` |
| Events | `EventEmitter` records interview-started, answer-scored, and interview-completed activity |
| Event loop | Async request handling, file I/O, a runtime demonstration endpoint, and event-loop questions |
| npm | `start`, `dev`, `test`, `reset`, and question-generation scripts |
| package.json | Project metadata, Node engine requirement, and scripts |

## npm commands

```powershell
npm start
npm run dev
npm test
npm run reset
npm run generate:questions
```

## Project structure

```text
node-core-interview-lab/
├── data/
│   ├── questions.json
│   ├── progress.json
│   ├── results.json
│   ├── metrics.json
│   ├── activity.json
│   └── study-guide.txt
├── public/
│   ├── css/styles.css
│   ├── js/app.js
│   └── index.html
├── scripts/
│   ├── generate-questions.js
│   └── reset-data.js
├── src/
│   ├── eventBus.js
│   ├── fileStore.js
│   ├── mimeTypes.js
│   ├── questionService.js
│   ├── resultService.js
│   ├── router.js
│   └── scoringService.js
├── tests/app.test.js
├── package.json
└── server.js
```

## How the no-repeat engine works

1. The browser creates a learner ID and keeps it in `localStorage`.
2. The server reads `data/progress.json`.
3. Questions already shown to that learner are removed from the selected level pool.
4. The server balances the remaining questions across topics.
5. The pool resets only when there are not enough unseen questions to create the requested interview.

Use **Past Results → Reset Question History** to manually begin a fresh cycle. Saved results are not deleted by that button.

## How scoring works

Each question has hidden rubric dimensions and technical keywords. The server scores coverage of those dimensions, response depth, structure, and relevant code vocabulary. The answer is not sent to the browser until after submission. This is a local educational scoring system, not an AI evaluator, so a human interviewer should still verify implementation quality and reasoning.

## Event-loop explanation

Node.js runs synchronous JavaScript first. Asynchronous file, network, timer, and operating-system work can continue outside the active JavaScript stack. When callbacks become ready, Node.js processes them through queues and event-loop phases. `process.nextTick()` and promise microtasks run at special checkpoints, while timers, poll, and check are separate phases. Long synchronous work blocks the JavaScript thread and delays unrelated requests.

## Tests

```powershell
npm test
```

The automated tests verify static assets, metadata, core-only server information, written-question safety, no-repeat behavior, rubric scoring, result creation, and streaming endpoints.
