(() => {
  'use strict';

  const TOPICS = [
    ['HTTP', 'HTTP Server'],
    ['Runtime & Event Loop', 'Event Loop'],
    ['File System', 'File System'],
    ['Streams & Buffers', 'Streams'],
    ['Events', 'Events'],
    ['CommonJS', 'CommonJS'],
    ['npm & package.json', 'npm'],
    ['Code Quality', 'Code Quality'],
    ['Errors & Process', 'Debugging'],
    ['Problem Solving', 'Problem Solving']
  ];

  const LEVEL_LABELS = {
    beginner: 'FOUNDATION',
    intermediate: 'PRACTITIONER',
    advanced: 'SENIOR',
    mixed: 'ADAPTIVE'
  };

  const state = {
    learnerId: getLearnerId(),
    learnerName: localStorage.getItem('nodeCoreLearnerName') || '',
    sessionId: null,
    questions: [],
    responses: {},
    feedback: {},
    index: 0,
    level: 'mixed',
    startedAt: 0,
    result: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function getLearnerId() {
    let id = localStorage.getItem('nodeCoreLearnerId');
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `learner-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem('nodeCoreLearnerId', id);
    }
    return id;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function wordCount(value) {
    const trimmed = String(value || '').trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}M ${remainder}S`;
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  async function loadMeta() {
    try {
      const metadata = await api('/api/meta');
      $('#questionTotal').textContent = String(metadata.totalQuestions).padStart(3, '0');
    } catch {
      toast('Cannot reach the Node.js server. Run npm start, then reload.');
    }
  }

  function openSetup() {
    const dialog = $('#setupDialog');
    $('#learnerName').value = state.learnerName;
    $('#setupStatus').textContent = '';
    if (!dialog.open) dialog.showModal();
    setTimeout(() => $('#learnerName').focus(), 30);
  }

  function closeSetup() {
    if ($('#setupDialog').open) $('#setupDialog').close();
  }

  async function startInterview(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const learnerName = String(formData.get('learnerName') || '').trim();
    const level = String(formData.get('level') || 'mixed');
    const count = Number(formData.get('count') || 8);
    const status = $('#setupStatus');
    const submit = form.querySelector('button[type="submit"]');

    if (!learnerName) {
      status.textContent = 'Enter your name before starting.';
      return;
    }

    submit.disabled = true;
    submit.innerHTML = 'SELECTING UNSEEN QUESTIONS…';
    status.textContent = '';

    try {
      const interview = await api('/api/interviews/start', {
        method: 'POST',
        body: JSON.stringify({ learnerId: state.learnerId, learnerName, level, count })
      });
      state.learnerName = learnerName;
      state.sessionId = interview.sessionId;
      state.questions = interview.questions;
      state.responses = {};
      state.feedback = {};
      state.index = 0;
      state.level = interview.level;
      state.startedAt = Date.now();
      state.result = null;
      localStorage.setItem('nodeCoreLearnerName', learnerName);
      closeSetup();
      showInterview();
      toast(interview.cycleRestarted
        ? 'You completed this question pool. A fresh cycle has started.'
        : `${interview.count} unseen questions selected. ${interview.remainingUnseen} remain in this pool.`);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'START INTERVIEW <span>→</span>';
    }
  }

  function showInterview() {
    $('#resultsScreen').classList.remove('active');
    $('#resultsScreen').setAttribute('aria-hidden', 'true');
    $('#interviewScreen').classList.add('active');
    $('#interviewScreen').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    buildTopicMap();
    renderQuestion();
    $('#interviewScreen').scrollTop = 0;
  }

  function buildTopicMap() {
    const map = $('#topicMap');
    map.innerHTML = TOPICS.map(([topic, label], index) => `
      <button type="button" data-topic="${escapeHtml(topic)}">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(label)}</strong>
        <em>NOW</em>
      </button>`).join('');
  }

  function draftKey(questionId) {
    return `nodeCoreDraft:${state.sessionId}:${questionId}`;
  }

  function renderQuestion() {
    const question = state.questions[state.index];
    if (!question) return;

    const position = state.index + 1;
    const total = state.questions.length;
    const currentFeedback = state.feedback[question.id];
    const savedDraft = state.responses[question.id] ?? localStorage.getItem(draftKey(question.id)) ?? '';
    state.responses[question.id] = savedDraft;

    $('#sessionPosition').textContent = `${String(position).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    $('#sessionProgressBar').style.width = `${(position / total) * 100}%`;
    $('#questionType').textContent = question.type || 'THEORY';
    $('#questionLevel').textContent = LEVEL_LABELS[question.level] || question.level.toUpperCase();
    $('#questionNumber').textContent = `QUESTION ${String(position).padStart(2, '0')}`;
    $('#questionTitle').textContent = question.title;
    $('#questionPrompt').textContent = question.prompt;
    $('#codeFile').textContent = question.codeFile || 'challenge.js';
    $('#questionCode').textContent = question.code || '';
    $('#challengePanel').classList.toggle('no-code', !question.code);
    $('#questionRequirements').innerHTML = (question.requirements || []).map((item, index) => `
      <span><b>${index + 1}</b>${escapeHtml(item)}</span>`).join('');

    $$('#topicMap button').forEach((button) => {
      const topic = button.dataset.topic;
      const completed = state.questions.some((item) => item.topic === topic && state.feedback[item.id]);
      button.classList.toggle('active', topic === question.topic);
      button.classList.toggle('completed', completed);
    });

    const answerPanel = $('#answerPanel');
    const feedbackPanel = $('#feedbackPanel');
    if (currentFeedback) {
      answerPanel.hidden = true;
      renderFeedback(currentFeedback);
      feedbackPanel.hidden = false;
    } else {
      feedbackPanel.hidden = true;
      answerPanel.hidden = false;
      const input = $('#answerInput');
      input.value = savedDraft;
      updateAnswerControls();
      setTimeout(() => input.focus(), 30);
    }
    $('#interviewScreen').scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateAnswerControls() {
    const input = $('#answerInput');
    const count = wordCount(input.value);
    $('#wordCount').textContent = `${count} WORD${count === 1 ? '' : 'S'}`;
    $('#submitAnswer').disabled = input.value.trim().length < 10;
  }

  function handleAnswerInput(event) {
    const question = state.questions[state.index];
    if (!question) return;
    state.responses[question.id] = event.currentTarget.value;
    localStorage.setItem(draftKey(question.id), event.currentTarget.value);
    updateAnswerControls();
  }

  async function submitCurrentAnswer() {
    const question = state.questions[state.index];
    if (!question || state.feedback[question.id]) return;
    const response = String(state.responses[question.id] || '').trim();
    if (response.length < 10) {
      toast('Write a fuller response before submitting.');
      return;
    }

    const button = $('#submitAnswer');
    button.disabled = true;
    button.innerHTML = 'SCORING RESPONSE…';
    try {
      const feedback = await api('/api/interviews/answer', {
        method: 'POST',
        body: JSON.stringify({ sessionId: state.sessionId, questionId: question.id, response })
      });
      state.feedback[question.id] = feedback;
      localStorage.removeItem(draftKey(question.id));
      $('#answerPanel').hidden = true;
      renderFeedback(feedback);
      $('#feedbackPanel').hidden = false;
      $('#feedbackPanel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    } finally {
      button.innerHTML = 'SUBMIT ANSWER <span>→</span>';
    }
  }

  function renderFeedback(feedback) {
    $('#responseScore').textContent = feedback.score;
    $('#feedbackTitle').textContent = feedback.title;
    $('#feedbackNote').textContent = feedback.note;
    $('#seniorAnswer').textContent = feedback.seniorAnswer;
    $('#seniorAnswer').hidden = true;
    $('#revealAnswer').textContent = '▶ REVEAL SENIOR-LEVEL ANSWER';
    $('#nextQuestion').innerHTML = state.index === state.questions.length - 1
      ? 'COMPLETE INTERVIEW <span>→</span>'
      : 'NEXT QUESTION <span>→</span>';
  }

  function revealSeniorAnswer() {
    const answer = $('#seniorAnswer');
    answer.hidden = !answer.hidden;
    $('#revealAnswer').textContent = answer.hidden
      ? '▶ REVEAL SENIOR-LEVEL ANSWER'
      : '▼ HIDE SENIOR-LEVEL ANSWER';
  }

  async function goToNextQuestion() {
    if (state.index < state.questions.length - 1) {
      state.index += 1;
      renderQuestion();
      return;
    }
    await completeInterview();
  }

  async function completeInterview() {
    const button = $('#nextQuestion');
    button.disabled = true;
    button.textContent = 'BUILDING REPORT…';
    try {
      const result = await api('/api/interviews/complete', {
        method: 'POST',
        body: JSON.stringify({ sessionId: state.sessionId })
      });
      state.result = result;
      renderResults(result);
    } catch (error) {
      toast(error.message);
      button.disabled = false;
      button.innerHTML = 'COMPLETE INTERVIEW <span>→</span>';
    }
  }

  function resultHeadline(score) {
    if (score >= 85) return 'You know the runtime.';
    if (score >= 70) return 'Strong core foundation.';
    if (score >= 50) return 'Keep going deeper.';
    return 'Back to the runtime.';
  }

  function renderResults(result) {
    $('#interviewScreen').classList.remove('active');
    $('#interviewScreen').setAttribute('aria-hidden', 'true');
    $('#resultsScreen').classList.add('active');
    $('#resultsScreen').setAttribute('aria-hidden', 'false');
    $('#resultsScreen').scrollTop = 0;

    $('#resultHeadline').textContent = resultHeadline(result.percentage);
    $('#finalScore').textContent = result.percentage;
    $('#scoreRing').style.background = `conic-gradient(var(--acid) 0deg ${result.percentage * 3.6}deg, #d8d8d0 ${result.percentage * 3.6}deg 360deg)`;
    $('#resultDescription').textContent = result.percentage >= 70
      ? 'Your responses show useful Node.js core understanding. Review the remaining gaps before the next interview cycle.'
      : 'Your score reflects technical vocabulary coverage and depth. A human interviewer should still verify implementation quality and reasoning under follow-up pressure.';
    $('#resultLearner').textContent = result.learnerName.toUpperCase();
    $('#resultLevel').textContent = LEVEL_LABELS[result.level] || result.level.toUpperCase();
    $('#resultDuration').textContent = formatDuration(result.durationSeconds);
    $('#downloadReport').href = `/api/results/${encodeURIComponent(result.id)}/report`;

    $('#topicBreakdown').innerHTML = result.topicBreakdown.map((item) => `
      <article class="topic-result${item.assessed ? '' : ' unassessed'}">
        <span>${escapeHtml(TOPICS.find(([name]) => name === item.topic)?.[1] || item.topic)}</span>
        <strong>${item.assessed ? item.score : '—'}</strong>
        <div class="bar"><i style="width:${item.assessed ? item.score : 0}%"></i></div>
      </article>`).join('');

    $('#reviewList').innerHTML = result.review.map((item, index) => `
      <details class="review-card">
        <summary>
          <span>${String(index + 1).padStart(2, '0')}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <em>${item.score}/100</em>
        </summary>
        <div class="review-content">
          <section><b>QUESTION</b>${escapeHtml(item.prompt)}</section>
          <section><b>YOUR RESPONSE</b>${escapeHtml(item.response)}</section>
          <section><b>SENIOR-LEVEL ANSWER</b>${escapeHtml(item.seniorAnswer)}</section>
          ${item.missing.length ? `<section><b>GAPS</b>${escapeHtml(item.missing.join(', '))}</section>` : ''}
        </div>
      </details>`).join('');
    $('#reviewSection').hidden = true;
  }

  function resetToHome() {
    $('#interviewScreen').classList.remove('active');
    $('#resultsScreen').classList.remove('active');
    $('#interviewScreen').setAttribute('aria-hidden', 'true');
    $('#resultsScreen').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function takeAgain() {
    resetToHome();
    openSetup();
  }

  function quitInterview() {
    const answered = Object.keys(state.feedback).length;
    if (answered && !window.confirm('Quit this interview? Your completed result will not be saved.')) return;
    resetToHome();
  }

  async function openHistory() {
    const dialog = $('#historyDialog');
    $('#historyStats').innerHTML = '<p>Loading results…</p>';
    $('#historyList').innerHTML = '';
    if (!dialog.open) dialog.showModal();
    try {
      const history = await api(`/api/results?learnerId=${encodeURIComponent(state.learnerId)}`);
      $('#historyStats').innerHTML = `
        <article><span>ATTEMPTS</span><strong>${history.totalAttempts}</strong></article>
        <article><span>AVERAGE</span><strong>${history.average}</strong></article>
        <article><span>BEST SCORE</span><strong>${history.best}</strong></article>`;
      $('#historyList').innerHTML = history.attempts.length
        ? history.attempts.map((item) => `
          <article class="history-item">
            <div><b>${escapeHtml(LEVEL_LABELS[item.level] || item.level.toUpperCase())}</b><br><span>${escapeHtml(formatDate(item.completedAt))}</span></div>
            <span>${item.totalQuestions} QUESTIONS</span>
            <strong>${item.percentage}/100</strong>
          </article>`).join('')
        : '<p>No completed interviews yet.</p>';
    } catch (error) {
      $('#historyStats').innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
  }

  async function resetQuestionHistory() {
    if (!window.confirm('Reset the non-repeat question memory for this browser? Saved results will remain.')) return;
    try {
      const response = await api('/api/progress/reset', {
        method: 'POST',
        body: JSON.stringify({ learnerId: state.learnerId })
      });
      toast(response.message);
    } catch (error) {
      toast(error.message);
    }
  }

  function handleKeyboard(event) {
    if (!$('#interviewScreen').classList.contains('active')) return;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !$('#answerPanel').hidden) {
      event.preventDefault();
      submitCurrentAnswer();
    }
  }

  function copyCode() {
    const question = state.questions[state.index];
    if (!question?.code) return;
    navigator.clipboard?.writeText(question.code)
      .then(() => toast('Code copied.'))
      .catch(() => toast('Copy is not available in this browser.'));
  }

  $$('[data-open-setup]').forEach((button) => button.addEventListener('click', openSetup));
  $('#closeSetup').addEventListener('click', closeSetup);
  $('#setupForm').addEventListener('submit', startInterview);
  $('#answerInput').addEventListener('input', handleAnswerInput);
  $('#submitAnswer').addEventListener('click', submitCurrentAnswer);
  $('#revealAnswer').addEventListener('click', revealSeniorAnswer);
  $('#nextQuestion').addEventListener('click', goToNextQuestion);
  $('#copyCode').addEventListener('click', copyCode);
  $('#quitInterview').addEventListener('click', quitInterview);
  $('#takeAgain').addEventListener('click', takeAgain);
  $('#restartTop').addEventListener('click', takeAgain);
  $('#reviewAnswers').addEventListener('click', () => {
    const review = $('#reviewSection');
    review.hidden = !review.hidden;
    if (!review.hidden) review.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#openHistory').addEventListener('click', openHistory);
  $('#closeHistory').addEventListener('click', () => $('#historyDialog').close());
  $('#resetHistory').addEventListener('click', resetQuestionHistory);
  document.addEventListener('keydown', handleKeyboard);

  $('#setupDialog').addEventListener('click', (event) => {
    if (event.target === $('#setupDialog')) closeSetup();
  });
  $('#historyDialog').addEventListener('click', (event) => {
    if (event.target === $('#historyDialog')) $('#historyDialog').close();
  });

  loadMeta();
})();
