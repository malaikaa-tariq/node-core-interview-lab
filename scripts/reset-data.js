const fs = require('node:fs/promises');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');

async function reset() {
  await Promise.all([
    fs.writeFile(path.join(dataDir, 'progress.json'), '{\n  "learners": {}\n}\n'),
    fs.writeFile(path.join(dataDir, 'results.json'), '[]\n'),
    fs.writeFile(path.join(dataDir, 'activity.json'), '[]\n'),
    fs.writeFile(path.join(dataDir, 'metrics.json'), '{\n  "requests": 0,\n  "interviewsStarted": 0,\n  "answersScored": 0,\n  "interviewsCompleted": 0\n}\n')
  ]);
  console.log('Progress, results, activity and metrics were reset.');
}

reset().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
