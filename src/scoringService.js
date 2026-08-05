const STOP_WORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'into', 'when', 'then', 'than', 'for', 'are', 'was', 'were',
  'will', 'would', 'should', 'could', 'have', 'has', 'had', 'not', 'only', 'also', 'using', 'used', 'use', 'its',
  'your', 'you', 'can', 'all', 'any', 'each', 'because', 'about', 'what', 'which', 'how', 'why', 'node', 'nodejs'
]);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/node\.js/g, 'nodejs')
    .replace(/[^a-z0-9_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(value) {
  return [...new Set(normalize(value).split(' ').filter((token) => token.length > 2 && !STOP_WORDS.has(token)))];
}

function keywordFound(text, keyword) {
  const normalizedKeyword = normalize(keyword);
  if (!normalizedKeyword) return false;
  if (normalizedKeyword.includes(' ')) return text.includes(normalizedKeyword);
  return text.split(' ').includes(normalizedKeyword) || text.includes(normalizedKeyword);
}

function scoreResponse(question, response) {
  const text = normalize(response);
  const words = text ? text.split(' ').filter(Boolean) : [];
  const rubric = Array.isArray(question.rubric) ? question.rubric : [];
  const rubricWeight = rubric.reduce((sum, criterion) => sum + (criterion.weight || 0), 0) || 80;
  let rubricScore = 0;
  const matched = [];
  const missing = [];

  for (const criterion of rubric) {
    const keywords = Array.isArray(criterion.keywords) ? criterion.keywords : [];
    const hits = keywords.filter((keyword) => keywordFound(text, keyword));
    const threshold = Math.max(1, Math.min(criterion.threshold || 1, keywords.length || 1));
    const ratio = keywords.length ? Math.min(hits.length / threshold, 1) : 0;
    const points = Math.round((criterion.weight || 0) * ratio);
    rubricScore += points;
    if (ratio >= 1) matched.push(criterion.label);
    else missing.push(criterion.label);
  }

  const depthScore = words.length >= 120 ? 14
    : words.length >= 75 ? 12
      : words.length >= 45 ? 9
        : words.length >= 25 ? 6
          : words.length >= 12 ? 3
            : 0;
  const structureScore = /\b(first|second|next|finally|however|therefore|because|for example|edge case)\b/.test(text) ? 4 : 0;
  const codeScore = /[`{}();=>]|\b(async|await|const|let|function|class|try|catch|pipe|promise)\b/.test(String(response || '').toLowerCase()) ? 2 : 0;
  const base = rubricWeight ? Math.round((rubricScore / rubricWeight) * 80) : 0;
  const score = Math.max(0, Math.min(100, base + depthScore + structureScore + codeScore));

  let title = 'Important gaps remain.';
  if (score >= 85) title = 'Strong senior-level coverage.';
  else if (score >= 70) title = 'Good answer with a few gaps.';
  else if (score >= 50) title = 'Partial understanding demonstrated.';
  else if (score >= 25) title = 'The direction is useful, but incomplete.';

  return {
    score,
    title,
    matched,
    missing,
    wordCount: words.length,
    note: missing.length
      ? `Missing or insufficiently explicit: ${missing.slice(0, 5).join(', ')}.`
      : 'The response covers every required scoring dimension.'
  };
}

function buildGeneratedRubric(correctOption, explanation, topicKeywords) {
  const optionTokens = meaningfulTokens(correctOption).slice(0, 5);
  const explanationTokens = meaningfulTokens(explanation).slice(0, 8);
  return [
    { label: 'correct core behavior', keywords: optionTokens, threshold: Math.min(2, optionTokens.length || 1), weight: 30 },
    { label: 'underlying mechanism', keywords: explanationTokens, threshold: Math.min(3, explanationTokens.length || 1), weight: 35 },
    { label: 'topic-specific vocabulary', keywords: topicKeywords, threshold: Math.min(2, topicKeywords.length || 1), weight: 15 }
  ];
}

module.exports = { scoreResponse, buildGeneratedRubric, meaningfulTokens };
