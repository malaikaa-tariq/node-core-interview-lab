const path = require('node:path');
const { EventEmitter } = require('node:events');
const { updateJson } = require('./fileStore');

const ACTIVITY_FILE = path.join(__dirname, '..', 'data', 'activity.json');
const METRICS_FILE = path.join(__dirname, '..', 'data', 'metrics.json');

class InterviewEventBus extends EventEmitter {}
const eventBus = new InterviewEventBus();

async function record(type, payload) {
  const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, at: new Date().toISOString(), ...payload };
  await updateJson(ACTIVITY_FILE, [], (items) => [...items.slice(-199), entry]);
}

function increment(field) {
  return updateJson(METRICS_FILE, {
    requests: 0,
    interviewsStarted: 0,
    answersScored: 0,
    interviewsCompleted: 0
  }, (metrics) => {
    metrics[field] = (metrics[field] || 0) + 1;
    return metrics;
  });
}

eventBus.on('interview:started', (payload) => {
  console.log(`[event] interview:started level=${payload.level} count=${payload.count}`);
  record('interview:started', payload).catch(console.error);
  increment('interviewsStarted').catch(console.error);
});

eventBus.on('answer:scored', (payload) => {
  record('answer:scored', payload).catch(console.error);
  increment('answersScored').catch(console.error);
});

eventBus.on('interview:completed', (payload) => {
  console.log(`[event] interview:completed score=${payload.percentage}%`);
  record('interview:completed', payload).catch(console.error);
  increment('interviewsCompleted').catch(console.error);
});

module.exports = eventBus;
