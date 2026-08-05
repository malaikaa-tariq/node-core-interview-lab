const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
const server = require('../server');

let baseUrl;

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const type = response.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
}

test.before(async () => {
  if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const dataDir = path.join(__dirname, '..', 'data');
  await Promise.all([
    fs.writeFile(path.join(dataDir, 'progress.json'), '{"learners":{}}\n'),
    fs.writeFile(path.join(dataDir, 'results.json'), '[]\n')
  ]);
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('serves the landing page and stylesheet', async () => {
  const home = await request('/');
  assert.equal(home.response.status, 200);
  assert.match(home.body, /Know Node/);
  assert.match(home.body, /BEGIN INTERVIEW/);

  const css = await request('/css/styles.css');
  assert.equal(css.response.status, 200);
  assert.match(css.response.headers.get('content-type'), /text\/css/);
  assert.match(css.body, /--acid/);
});

test('metadata proves a core-only server and a large question bank', async () => {
  const { response, body } = await request('/api/meta');
  assert.equal(response.status, 200);
  assert.equal(body.server.express, false);
  assert.ok(body.totalQuestions >= 90);
  assert.equal(body.topics.length, 10);
  assert.ok(body.server.modules.includes('stream'));
});

test('starts a written interview without exposing scoring answers', async () => {
  const { response, body } = await request('/api/interviews/start', {
    method: 'POST',
    body: JSON.stringify({ learnerId: 'test-learner-a', learnerName: 'Test Learner', level: 'mixed', count: 8 })
  });
  assert.equal(response.status, 201);
  assert.equal(body.questions.length, 8);
  assert.ok(body.questions.every((question) => Array.isArray(question.requirements)));
  assert.ok(body.questions.every((question) => !('rubric' in question)));
  assert.ok(body.questions.every((question) => !('seniorAnswer' in question)));
});

test('does not repeat questions in consecutive interviews before pool exhaustion', async () => {
  const learnerId = 'test-no-repeat';
  const first = await request('/api/interviews/start', {
    method: 'POST',
    body: JSON.stringify({ learnerId, learnerName: 'Fresh Questions', level: 'mixed', count: 10 })
  });
  const second = await request('/api/interviews/start', {
    method: 'POST',
    body: JSON.stringify({ learnerId, learnerName: 'Fresh Questions', level: 'mixed', count: 10 })
  });
  const firstIds = new Set(first.body.questions.map((question) => question.id));
  const overlap = second.body.questions.filter((question) => firstIds.has(question.id));
  assert.equal(overlap.length, 0);
});

test('scores written answers, completes an interview and streams a report', async () => {
  const start = await request('/api/interviews/start', {
    method: 'POST',
    body: JSON.stringify({ learnerId: 'test-complete', learnerName: 'Complete Learner', level: 'mixed', count: 5 })
  });
  assert.equal(start.response.status, 201);

  for (const question of start.body.questions) {
    const scored = await request('/api/interviews/answer', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: start.body.sessionId,
        questionId: question.id,
        response: 'I would use asynchronous Node.js core APIs, validate the request or input, handle errors, avoid blocking the event loop, explain the queue or stream behavior, and finish the response or operation safely with clear status codes and cleanup.'
      })
    });
    assert.equal(scored.response.status, 200);
    assert.equal(typeof scored.body.score, 'number');
    assert.ok(scored.body.seniorAnswer.length > 20);
  }

  const completed = await request('/api/interviews/complete', {
    method: 'POST',
    body: JSON.stringify({ sessionId: start.body.sessionId })
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.body.review.length, 5);
  assert.equal(completed.body.topicBreakdown.length, 10);

  const report = await request(`/api/results/${completed.body.id}/report`);
  assert.equal(report.response.status, 200);
  assert.match(report.response.headers.get('content-disposition'), /attachment/);
  assert.match(report.body, /NODE\/CORE INTERVIEW LAB/);
});

test('uses a real readable stream for the study guide endpoint', async () => {
  const guide = await request('/api/study-guide');
  assert.equal(guide.response.status, 200);
  assert.match(guide.response.headers.get('content-disposition'), /attachment/);
  assert.match(guide.body, /EVENT LOOP/);
  assert.match(guide.body, /COMMONJS/);
});
