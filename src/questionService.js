const path = require('node:path');
const crypto = require('node:crypto');
const { readJson, updateJson } = require('./fileStore');
const eventBus = require('./eventBus');

const QUESTIONS_FILE = path.join(__dirname, '..', 'data', 'questions.json');
const PROGRESS_FILE = path.join(__dirname, '..', 'data', 'progress.json');
const sessions = new Map();

const TOPIC_ORDER = [
  'HTTP',
  'Runtime & Event Loop',
  'File System',
  'Streams & Buffers',
  'Events',
  'CommonJS',
  'npm & package.json',
  'Errors & Process',
  'Code Quality',
  'Problem Solving'
];

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = crypto.randomInt(index + 1);
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function normalizeLevel(level) {
  const value = String(level || '').toLowerCase();
  if (value === 'foundation') return 'beginner';
  if (value === 'practitioner') return 'intermediate';
  if (value === 'senior') return 'advanced';
  if (value === 'adaptive') return 'mixed';
  return ['beginner', 'intermediate', 'advanced', 'mixed'].includes(value) ? value : 'mixed';
}

function safeQuestion(question) {
  return {
    id: question.id,
    topic: question.topic,
    level: question.level,
    type: question.type,
    title: question.title,
    prompt: question.prompt,
    codeFile: question.codeFile || 'challenge.js',
    code: question.code || '',
    requirements: question.requirements || []
  };
}

function chooseBalanced(pool, count) {
  const chosen = [];
  const chosenIds = new Set();

  for (const topic of TOPIC_ORDER) {
    if (chosen.length >= count) break;
    const candidates = pool
      .filter((question) => question.topic === topic && !chosenIds.has(question.id))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    if (!candidates.length) continue;
    const highestPriority = candidates[0].priority || 0;
    const topCandidates = candidates.filter((question) => (question.priority || 0) === highestPriority);
    const selected = shuffle(topCandidates)[0];
    chosen.push(selected);
    chosenIds.add(selected.id);
  }

  if (chosen.length < count) {
    const remainder = shuffle(pool.filter((question) => !chosenIds.has(question.id)))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const question of remainder) {
      if (chosen.length >= count) break;
      chosen.push(question);
      chosenIds.add(question.id);
    }
  }

  return chosen;
}

async function getMetadata() {
  const questions = await readJson(QUESTIONS_FILE, []);
  const byLevel = Object.fromEntries(['beginner', 'intermediate', 'advanced'].map((level) => [
    level,
    questions.filter((question) => question.level === level).length
  ]));
  const topics = TOPIC_ORDER.map((topic) => ({
    name: topic,
    count: questions.filter((question) => question.topic === topic).length
  }));
  return { totalQuestions: questions.length, byLevel, topics, defaultQuestionCount: 8 };
}

async function startInterview({ learnerId, learnerName, level, count }) {
  if (!learnerId || typeof learnerId !== 'string') {
    const error = new Error('A learner ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedLevel = normalizeLevel(level);
  const safeCount = [5, 8, 10].includes(Number(count)) ? Number(count) : 8;
  const questions = await readJson(QUESTIONS_FILE, []);
  const pool = normalizedLevel === 'mixed'
    ? questions
    : questions.filter((question) => question.level === normalizedLevel);
  if (!pool.length) {
    const error = new Error('No questions are available for the selected level.');
    error.statusCode = 404;
    throw error;
  }

  const targetCount = Math.min(safeCount, pool.length);
  let selection = [];
  let cycleRestarted = false;
  let remainingUnseen = 0;
  let cycle = 1;

  await updateJson(PROGRESS_FILE, { learners: {} }, (progress) => {
    progress.learners ||= {};
    const learner = progress.learners[learnerId] ||= {
      name: learnerName || 'Learner',
      seenIds: [],
      cycles: {},
      updatedAt: new Date().toISOString()
    };
    learner.name = learnerName || learner.name || 'Learner';
    learner.seenIds ||= [];
    learner.cycles ||= {};
    learner.cycles[normalizedLevel] ||= 1;

    const poolIds = new Set(pool.map((question) => question.id));
    const unseen = pool.filter((question) => !learner.seenIds.includes(question.id));
    selection = chooseBalanced(unseen, targetCount);

    if (selection.length < targetCount) {
      cycleRestarted = true;
      learner.cycles[normalizedLevel] += 1;
      const alreadySelected = new Set(selection.map((question) => question.id));
      learner.seenIds = learner.seenIds.filter((id) => !poolIds.has(id));
      selection.push(...chooseBalanced(pool.filter((question) => !alreadySelected.has(question.id)), targetCount - selection.length));
    }

    learner.seenIds = [...new Set([...learner.seenIds, ...selection.map((question) => question.id)])];
    remainingUnseen = Math.max(0, pool.length - learner.seenIds.filter((id) => poolIds.has(id)).length);
    cycle = learner.cycles[normalizedLevel];
    learner.updatedAt = new Date().toISOString();
    return progress;
  });

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    id: sessionId,
    learnerId,
    learnerName: String(learnerName || 'Learner').slice(0, 60),
    level: normalizedLevel,
    questionIds: selection.map((question) => question.id),
    answers: {},
    startedAt: new Date().toISOString(),
    completed: false
  });

  eventBus.emit('interview:started', {
    learnerId,
    level: normalizedLevel,
    count: selection.length
  });

  return {
    sessionId,
    level: normalizedLevel,
    count: selection.length,
    cycle,
    cycleRestarted,
    remainingUnseen,
    poolSize: pool.length,
    topicOrder: TOPIC_ORDER,
    questions: selection.map(safeQuestion)
  };
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

async function getQuestion(questionId) {
  const questions = await readJson(QUESTIONS_FILE, []);
  return questions.find((question) => question.id === questionId) || null;
}

async function getQuestionsByIds(ids) {
  const questions = await readJson(QUESTIONS_FILE, []);
  const map = new Map(questions.map((question) => [question.id, question]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

function saveAnswer(sessionId, questionId, answer) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.answers[questionId] = answer;
  return true;
}

function markCompleted(sessionId) {
  const session = sessions.get(sessionId);
  if (session) session.completed = true;
}

async function resetHistory(learnerId) {
  await updateJson(PROGRESS_FILE, { learners: {} }, (progress) => {
    if (progress.learners) delete progress.learners[learnerId];
    return progress;
  });
}

module.exports = {
  TOPIC_ORDER,
  getMetadata,
  startInterview,
  getSession,
  getQuestion,
  getQuestionsByIds,
  saveAnswer,
  markCompleted,
  resetHistory
};
