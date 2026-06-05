import PRACTICE_WORDS_TEXT from '../data/practiceWords.txt?raw';
import VALID_GUESSES from '../data/validGuesses.json';
import { compareWord } from './compareWord.js';

const STATUS_PATTERN = {
  correct: 'G',
  present: 'Y',
  absent: 'B',
};

const DEFAULT_ANSWER_WORDS = normalizeWordList(PRACTICE_WORDS_TEXT.split(/\r?\n/));
const DEFAULT_RANKING_WORDS = normalizeWordList(VALID_GUESSES);

function normalizeWord(word) {
  const normalized = String(word || '').trim().toUpperCase();
  return /^[A-Z]{5}$/.test(normalized) ? normalized : null;
}

function normalizeWordList(words) {
  const seen = new Set();
  const normalizedWords = [];

  for (const word of words || []) {
    const normalized = normalizeWord(word);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      normalizedWords.push(normalized);
    }
  }

  return normalizedWords;
}

function optionWordList(words, fallback) {
  if (typeof words === 'string') {
    return normalizeWordList(words.split(/\r?\n/));
  }

  if (Array.isArray(words)) {
    return normalizeWordList(words);
  }

  return fallback;
}

function ensureWord(words, word) {
  const normalized = normalizeWord(word);
  if (!normalized || words.includes(normalized)) return words;
  return [...words, normalized];
}

function normalizeStatus(status) {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'WON' || normalized === 'LOST' ? normalized : null;
}

function gameTimestamp(game) {
  const values = [game?.completedAt, game?.gameDate, game?.date];

  for (const value of values) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return 0;
}

function normalizeCompletedGame(game) {
  if (!game) return null;

  const targetWord = normalizeWord(game.targetWord || game.word || game.answer);
  const sourceGuesses = Array.isArray(game.guesses)
    ? game.guesses
    : Array.isArray(game.submittedWords)
      ? game.submittedWords
      : [];
  const guesses = normalizeWordList(sourceGuesses);
  const status = normalizeStatus(game.status || game.gameStatus);
  const isCompleted = Boolean(status || game.completedAt);

  if (!isCompleted || !targetWord || guesses.length === 0) {
    return null;
  }

  return {
    id: game.id || game.gameId || null,
    gameDate: game.gameDate || game.date || null,
    completedAt: game.completedAt || null,
    status: status || (guesses.includes(targetWord) ? 'WON' : 'LOST'),
    attempts: Number.isFinite(Number(game.attempts)) ? Number(game.attempts) : guesses.length,
    targetWord,
    guesses,
  };
}

function patternKey(guess, targetWord) {
  return compareWord(guess, targetWord)
    .map((cell) => STATUS_PATTERN[cell.status] || 'B')
    .join('');
}

function createPatternBuckets(guess, candidates) {
  const buckets = new Map();

  for (const candidate of candidates) {
    const key = patternKey(guess, candidate);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  return buckets;
}

function metricsFromBuckets(buckets, total) {
  if (total <= 0) {
    return {
      entropy: 0,
      expectedRemaining: 0,
      minBucketSize: 0,
      maxBucketSize: 0,
      patternCount: 0,
    };
  }

  let entropy = 0;
  let expectedRemaining = 0;
  let minBucketSize = Infinity;
  let maxBucketSize = 0;

  for (const count of buckets.values()) {
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
    expectedRemaining += probability * count;
    minBucketSize = Math.min(minBucketSize, count);
    maxBucketSize = Math.max(maxBucketSize, count);
  }

  return {
    entropy,
    expectedRemaining,
    minBucketSize,
    maxBucketSize,
    patternCount: buckets.size,
  };
}

function computeGuessMetrics(guess, candidates) {
  const buckets = createPatternBuckets(guess, candidates);
  return metricsFromBuckets(buckets, candidates.length);
}

function compareRankingEntries(candidateSet) {
  return (a, b) => {
    if (b.entropy !== a.entropy) return b.entropy - a.entropy;
    if (a.expectedRemaining !== b.expectedRemaining) {
      return a.expectedRemaining - b.expectedRemaining;
    }

    const aIsCandidate = candidateSet.has(a.word);
    const bIsCandidate = candidateSet.has(b.word);
    if (aIsCandidate !== bIsCandidate) return aIsCandidate ? -1 : 1;

    return a.word.localeCompare(b.word);
  };
}

function rankWords(candidates, rankingWords) {
  const candidateSet = new Set(candidates);

  return rankingWords
    .map((word) => ({
      word,
      ...computeGuessMetrics(word, candidates),
    }))
    .sort(compareRankingEntries(candidateSet));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function skillScoreForRank(rank, total) {
  if (!rank || total <= 0) return null;
  if (total === 1) return 99;

  return clamp(Math.round(99 * (1 - ((rank - 1) / (total - 1)))), 0, 99);
}

function luckScoreForOutcome(metrics, actualRemaining) {
  if (!metrics || !Number.isFinite(actualRemaining)) return null;

  const expected = metrics.expectedRemaining;
  const minBucket = metrics.minBucketSize;
  const maxBucket = metrics.maxBucketSize;

  if (maxBucket === minBucket) return 50;

  if (actualRemaining <= expected) {
    const range = Math.max(1, expected - minBucket);
    return clamp(Math.round(50 + ((expected - actualRemaining) / range) * 49), 50, 99);
  }

  const range = Math.max(1, maxBucket - expected);
  return clamp(Math.round(50 - ((actualRemaining - expected) / range) * 50), 0, 50);
}

function average(values) {
  const numericValues = values.filter((value) => Number.isFinite(value));
  if (numericValues.length === 0) return null;

  return round(
    numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length,
    1,
  );
}

function gameListFromStats(stats) {
  if (Array.isArray(stats?.completedDailyGames)) return stats.completedDailyGames;
  if (Array.isArray(stats?.dailyGames)) return stats.dailyGames;
  return [];
}

export function selectLatestCompletedDailyGame(stats) {
  let latest = null;

  gameListFromStats(stats).forEach((game, index) => {
    const normalized = normalizeCompletedGame(game);
    if (!normalized) return;

    const timestamp = gameTimestamp(game);
    if (
      !latest ||
      timestamp > latest.timestamp ||
      (timestamp === latest.timestamp && index < latest.index)
    ) {
      latest = { game, index, timestamp };
    }
  });

  return latest?.game || null;
}

export function analyzeCompletedDailyGame(game, options = {}) {
  const normalizedGame = normalizeCompletedGame(game);
  if (!normalizedGame) return null;

  const answerWords = ensureWord(
    optionWordList(options.answerWords, DEFAULT_ANSWER_WORDS),
    normalizedGame.targetWord,
  );
  const rankingWords = optionWordList(options.rankingWords, DEFAULT_RANKING_WORDS);
  let remainingCandidates = answerWords;
  const rows = [];

  for (const guess of normalizedGame.guesses) {
    const remainingBefore = remainingCandidates.length;
    const ranking = rankWords(remainingCandidates, rankingWords);
    const botChoice = ranking[0] || null;
    const playerRankIndex = ranking.findIndex((entry) => entry.word === guess);
    const playerRank = playerRankIndex >= 0 ? playerRankIndex + 1 : null;
    const playerMetrics = playerRank
      ? ranking[playerRankIndex]
      : { word: guess, ...computeGuessMetrics(guess, remainingCandidates) };
    const observedPattern = patternKey(guess, normalizedGame.targetWord);
    const nextCandidates = remainingCandidates.filter(
      (candidate) => patternKey(guess, candidate) === observedPattern,
    );
    const remainingAfter = nextCandidates.length;
    const luckScore = luckScoreForOutcome(playerMetrics, remainingAfter);

    rows.push({
      attempt: rows.length + 1,
      guess,
      pattern: observedPattern,
      remainingBefore,
      remainingAfter,
      eliminated: remainingBefore - remainingAfter,
      eliminatedPercent: remainingBefore === 0
        ? 0
        : round(((remainingBefore - remainingAfter) / remainingBefore) * 100, 1),
      entropy: round(playerMetrics.entropy, 2),
      expectedRemaining: round(playerMetrics.expectedRemaining, 1),
      rank: playerRank,
      rankTotal: ranking.length,
      skillScore: skillScoreForRank(playerRank, ranking.length),
      luckScore,
      botGuess: botChoice?.word || null,
      botEntropy: botChoice ? round(botChoice.entropy, 2) : null,
      botExpectedRemaining: botChoice ? round(botChoice.expectedRemaining, 1) : null,
      isAnswer: guess === normalizedGame.targetWord,
    });

    remainingCandidates = nextCandidates.length > 0
      ? nextCandidates
      : [normalizedGame.targetWord];

    if (guess === normalizedGame.targetWord) break;
  }

  const finalRow = rows[rows.length - 1] || null;

  return {
    ...normalizedGame,
    guesses: rows.map((row) => row.guess),
    guessCount: rows.length,
    initialCandidateCount: answerWords.length,
    rankingWordCount: rankingWords.length,
    finalRemaining: finalRow?.remainingAfter ?? answerWords.length,
    isSolved: rows.some((row) => row.isAnswer),
    averageSkill: average(rows.slice(1).map((row) => row.skillScore)),
    averageLuck: average(rows.map((row) => row.luckScore)),
    rows,
  };
}
