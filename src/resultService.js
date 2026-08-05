const path = require('node:path');
const crypto = require('node:crypto');
const { readJson, updateJson } = require('./fileStore');
const questionService = require('./questionService');
const { scoreResponse } = require('./scoringService');
const eventBus = require('./eventBus');

const RESULTS_FILE = path.join(__dirname, '..', 'data', 'results.json');

function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

async function scoreAnswer({ sessionId, questionId, response }) {
  const session = questionService.getSession(sessionId);
  if (!session) {
    const error = new Error('This interview session was not found. Restart the interview if the server was restarted.');
    error.statusCode = 404;
    throw error;
  }
  if (session.completed) {
    const error = new Error('This interview is already complete.');
    error.statusCode = 409;
    throw error;
  }
  if (!session.questionIds.includes(questionId)) {
    const error = new Error('This question does not belong to the active interview.');
    error.statusCode = 400;
    throw error;
  }

  const cleanResponse = String(response || '').trim();
  if (cleanResponse.length < 10) {
    const error = new Error('Write at least 10 characters before submitting.');
    error.statusCode = 400;
    throw error;
  }
  if (cleanResponse.length > 20_000) {
    const error = new Error('The response is too long.');
    error.statusCode = 413;
    throw error;
  }

  const question = await questionService.getQuestion(questionId);
  if (!question) {
    const error = new Error('Question not found.');
    error.statusCode = 404;
    throw error;
  }

  const feedback = scoreResponse(question, cleanResponse);
  const answer = {
    questionId,
    response: cleanResponse,
    score: feedback.score,
    matched: feedback.matched,
    missing: feedback.missing,
    wordCount: feedback.wordCount,
    submittedAt: new Date().toISOString()
  };
  questionService.saveAnswer(sessionId, questionId, answer);

  eventBus.emit('answer:scored', {
    learnerId: session.learnerId,
    questionId,
    topic: question.topic,
    score: feedback.score
  });

  return {
    questionId,
    ...feedback,
    seniorAnswer: question.seniorAnswer,
    requirements: question.requirements
  };
}

async function completeInterview({ sessionId }) {
  const session = questionService.getSession(sessionId);
  if (!session) {
    const error = new Error('This interview session was not found.');
    error.statusCode = 404;
    throw error;
  }
  if (session.completed) {
    const error = new Error('This interview has already been completed.');
    error.statusCode = 409;
    throw error;
  }

  const unanswered = session.questionIds.filter((id) => !session.answers[id]);
  if (unanswered.length) {
    const error = new Error(`${unanswered.length} question${unanswered.length === 1 ? '' : 's'} still need an answer.`);
    error.statusCode = 400;
    throw error;
  }

  const questions = await questionService.getQuestionsByIds(session.questionIds);
  const review = questions.map((question) => {
    const answer = session.answers[question.id];
    return {
      questionId: question.id,
      topic: question.topic,
      level: question.level,
      type: question.type,
      title: question.title,
      prompt: question.prompt,
      code: question.code || '',
      response: answer.response,
      score: answer.score,
      matched: answer.matched,
      missing: answer.missing,
      seniorAnswer: question.seniorAnswer
    };
  });

  const topicGroups = {};
  for (const item of review) {
    topicGroups[item.topic] ||= [];
    topicGroups[item.topic].push(item.score);
  }
  const topicBreakdown = questionService.TOPIC_ORDER.map((topic) => ({
    topic,
    assessed: Boolean(topicGroups[topic]),
    score: topicGroups[topic] ? average(topicGroups[topic]) : null
  }));
  const assessed = topicBreakdown.filter((item) => item.assessed).sort((a, b) => a.score - b.score);
  const percentage = average(review.map((item) => item.score));
  const result = {
    id: crypto.randomUUID(),
    learnerId: session.learnerId,
    learnerName: session.learnerName,
    level: session.level,
    percentage,
    score: percentage,
    totalQuestions: review.length,
    durationSeconds: Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)),
    weakTopic: assessed[0]?.topic || null,
    topicBreakdown,
    review,
    completedAt: new Date().toISOString()
  };

  await updateJson(RESULTS_FILE, [], (results) => [...results.slice(-499), result]);
  questionService.markCompleted(sessionId);
  eventBus.emit('interview:completed', {
    learnerId: session.learnerId,
    resultId: result.id,
    percentage
  });
  return result;
}

async function getResults(learnerId) {
  const results = await readJson(RESULTS_FILE, []);
  const attempts = results.filter((result) => result.learnerId === learnerId).slice(-20).reverse();
  return {
    attempts,
    totalAttempts: attempts.length,
    average: average(attempts.map((item) => item.percentage)),
    best: attempts.length ? Math.max(...attempts.map((item) => item.percentage)) : 0
  };
}

async function getResult(resultId) {
  const results = await readJson(RESULTS_FILE, []);
  return results.find((result) => result.id === resultId) || null;
}

function formatReport(result) {
  const lines = [
    'NODE/CORE INTERVIEW LAB — ASSESSMENT REPORT',
    '================================================',
    `Learner: ${result.learnerName}`,
    `Level: ${result.level}`,
    `Completed: ${result.completedAt}`,
    `Score: ${result.percentage}/100`,
    `Duration: ${result.durationSeconds}s`,
    '',
    'TOPIC BREAKDOWN',
    ...result.topicBreakdown.map((item) => `${item.topic}: ${item.assessed ? `${item.score}/100` : 'Not assessed'}`),
    '',
    'ANSWER REVIEW'
  ];
  result.review.forEach((item, index) => {
    lines.push('', `${index + 1}. ${item.title} — ${item.score}/100`, item.prompt, '', 'Your response:', item.response, '', 'Senior-level answer:', item.seniorAnswer);
  });
  return `${lines.join('\n')}\n`;
}

module.exports = { scoreAnswer, completeInterview, getResults, getResult, formatReport };
