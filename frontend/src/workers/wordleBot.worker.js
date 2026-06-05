import PRACTICE_WORDS_TEXT from '../data/practiceWords.txt?raw';
import VALID_GUESSES from '../data/validGuesses.json';
import FREQUENCY_CONFIG from '../data/wordFrequencies.json';
import { analyzeCompletedDailyGame } from '../utils/wordleBot.js';

const answerWords = PRACTICE_WORDS_TEXT
  .split(/\r?\n/)
  .map((word) => word.trim())
  .filter(Boolean);
const rankingWords = VALID_GUESSES;
const rankCache = new Map();

function postProgress(requestId, stage) {
  self.postMessage({
    type: 'analysis-progress',
    requestId,
    stage,
  });
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type !== 'analyze-game') return;

  const { requestId, game } = message;

  try {
    postProgress(requestId, 'Preparing word lists');
    postProgress(requestId, 'Ranking candidate guesses');

    const analysis = analyzeCompletedDailyGame(game, {
      answerWords,
      rankingWords,
      frequencyConfig: FREQUENCY_CONFIG,
      rankCache,
    });

    if (!analysis) {
      throw new Error('No completed daily game is ready for analysis.');
    }

    postProgress(requestId, 'Comparing bot path');
    self.postMessage({
      type: 'analysis-complete',
      requestId,
      analysis,
    });
  } catch (err) {
    self.postMessage({
      type: 'analysis-error',
      requestId,
      error: err?.message || 'Unable to analyze this daily game.',
    });
  }
};
