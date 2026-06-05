import { compareWord } from './compareWord.js';

const STATUS_PATTERN = {
  correct: 'G',
  present: 'Y',
  absent: 'B',
};

const DEFAULT_FREQUENCY_CONFIG = {
  defaultWeight: 1,
  commonWordWeight: 1.8,
  rareLetterPenalty: 0.92,
  duplicateLetterPenalty: 0.86,
  commonWords: [],
  rareLetters: ['J', 'Q', 'X', 'Z'],
};

function normalizeWord(word) {
  const normalized = String(word || '').trim().toUpperCase();
  return /^[A-Z]{5}$/.test(normalized) ? normalized : null;
}

export function normalizeWordList(words) {
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

function optionWordList(words) {
  if (typeof words === 'string') {
    return normalizeWordList(words.split(/\r?\n/));
  }

  return normalizeWordList(words);
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

function normalizeFrequencyConfig(config = {}) {
  const merged = { ...DEFAULT_FREQUENCY_CONFIG, ...(config || {}) };

  return {
    ...merged,
    defaultWeight: Number(merged.defaultWeight) > 0 ? Number(merged.defaultWeight) : 1,
    commonWordWeight: Number(merged.commonWordWeight) > 0
      ? Number(merged.commonWordWeight)
      : DEFAULT_FREQUENCY_CONFIG.commonWordWeight,
    rareLetterPenalty: Number(merged.rareLetterPenalty) > 0
      ? Number(merged.rareLetterPenalty)
      : DEFAULT_FREQUENCY_CONFIG.rareLetterPenalty,
    duplicateLetterPenalty: Number(merged.duplicateLetterPenalty) > 0
      ? Number(merged.duplicateLetterPenalty)
      : DEFAULT_FREQUENCY_CONFIG.duplicateLetterPenalty,
    commonWords: new Set(normalizeWordList(merged.commonWords || [])),
    rareLetters: new Set(
      Array.isArray(merged.rareLetters)
        ? merged.rareLetters.map((letter) => String(letter || '').toUpperCase()).filter(Boolean)
        : DEFAULT_FREQUENCY_CONFIG.rareLetters,
    ),
  };
}

export function getWordWeight(word, frequencyConfig = {}) {
  const normalized = normalizeWord(word);
  if (!normalized) return 0;

  const config = normalizeFrequencyConfig(frequencyConfig);
  const letters = normalized.split('');
  const uniqueLetters = new Set(letters);
  let weight = config.defaultWeight;

  if (config.commonWords.has(normalized)) {
    weight *= config.commonWordWeight;
  }

  uniqueLetters.forEach((letter) => {
    if (config.rareLetters.has(letter)) {
      weight *= config.rareLetterPenalty;
    }
  });

  const duplicateCount = letters.length - uniqueLetters.size;
  if (duplicateCount > 0) {
    weight *= config.duplicateLetterPenalty ** duplicateCount;
  }

  return Math.max(0.01, weight);
}

function buildCandidateWeights(candidates, frequencyConfig) {
  const weights = new Map();

  candidates.forEach((word) => {
    weights.set(word, getWordWeight(word, frequencyConfig));
  });

  return weights;
}

function patternKey(guess, targetWord) {
  return compareWord(guess, targetWord)
    .map((cell) => STATUS_PATTERN[cell.status] || 'B')
    .join('');
}

function createPatternBuckets(guess, candidates, candidateWeights) {
  const buckets = new Map();

  for (const candidate of candidates) {
    const key = patternKey(guess, candidate);
    const weight = candidateWeights.get(candidate) || 1;
    const bucket = buckets.get(key) || { count: 0, weight: 0 };

    bucket.count += 1;
    bucket.weight += weight;
    buckets.set(key, bucket);
  }

  return buckets;
}

function metricsFromBuckets(buckets, totalWeight) {
  if (totalWeight <= 0) {
    return {
      entropy: 0,
      expectedRemaining: 0,
      expectedWeightedRemaining: 0,
      minBucketSize: 0,
      maxBucketSize: 0,
      patternCount: 0,
    };
  }

  let entropy = 0;
  let expectedRemaining = 0;
  let expectedWeightedRemaining = 0;
  let minBucketSize = Infinity;
  let maxBucketSize = 0;

  for (const bucket of buckets.values()) {
    const probability = bucket.weight / totalWeight;
    entropy -= probability * Math.log2(probability);
    expectedRemaining += probability * bucket.count;
    expectedWeightedRemaining += probability * bucket.weight;
    minBucketSize = Math.min(minBucketSize, bucket.count);
    maxBucketSize = Math.max(maxBucketSize, bucket.count);
  }

  return {
    entropy,
    expectedRemaining,
    expectedWeightedRemaining,
    minBucketSize,
    maxBucketSize,
    patternCount: buckets.size,
  };
}

export function computeGuessMetrics(guess, candidates, frequencyConfig = {}) {
  const normalizedGuess = normalizeWord(guess);
  const normalizedCandidates = normalizeWordList(candidates);
  if (!normalizedGuess || normalizedCandidates.length === 0) {
    return {
      entropy: 0,
      expectedRemaining: 0,
      expectedWeightedRemaining: 0,
      minBucketSize: 0,
      maxBucketSize: 0,
      patternCount: 0,
    };
  }

  const candidateWeights = buildCandidateWeights(normalizedCandidates, frequencyConfig);
  const totalWeight = [...candidateWeights.values()].reduce((sum, weight) => sum + weight, 0);
  const buckets = createPatternBuckets(normalizedGuess, normalizedCandidates, candidateWeights);

  return metricsFromBuckets(buckets, totalWeight);
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

function cacheKeyForCandidates(candidates) {
  return candidates.join('|');
}

function rankWords(candidates, rankingWords, frequencyConfig, rankCache) {
  const key = rankCache ? cacheKeyForCandidates(candidates) : null;
  if (key && rankCache.has(key)) return rankCache.get(key);

  const candidateSet = new Set(candidates);
  const ranking = rankingWords
    .map((word) => ({
      word,
      ...computeGuessMetrics(word, candidates, frequencyConfig),
    }))
    .sort(compareRankingEntries(candidateSet));

  if (key) rankCache.set(key, ranking);
  return ranking;
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

function formatAnalysisRow({
  attempt,
  guess,
  targetWord,
  remainingBefore,
  remainingAfter,
  observedPattern,
  playerRank,
  rankingLength,
  playerMetrics,
  luckScore,
  botChoice,
}) {
  return {
    attempt,
    guess,
    pattern: observedPattern,
    remainingBefore,
    remainingAfter,
    eliminated: remainingBefore - remainingAfter,
    eliminatedPercent: remainingBefore === 0
      ? 0
      : round(((remainingBefore - remainingAfter) / remainingBefore) * 100, 1),
    entropy: round(playerMetrics.entropy, 2),
    weightedEntropy: round(playerMetrics.entropy, 2),
    expectedRemaining: round(playerMetrics.expectedRemaining, 1),
    rank: playerRank,
    rankTotal: rankingLength,
    skillScore: skillScoreForRank(playerRank, rankingLength),
    luckScore,
    botGuess: botChoice?.word || null,
    botEntropy: botChoice ? round(botChoice.entropy, 2) : null,
    botExpectedRemaining: botChoice ? round(botChoice.expectedRemaining, 1) : null,
    isAnswer: guess === targetWord,
  };
}

function nextCandidatePool(guess, targetWord, remainingCandidates) {
  const observedPattern = patternKey(guess, targetWord);
  const candidates = remainingCandidates.filter(
    (candidate) => patternKey(guess, candidate) === observedPattern,
  );

  return {
    observedPattern,
    candidates: candidates.length > 0 ? candidates : [targetWord],
    rawRemainingAfter: candidates.length,
  };
}

function bestUnusedGuess(ranking, usedGuesses, targetWord) {
  if (ranking.length === 0) return targetWord;
  return ranking.find((entry) => !usedGuesses.has(entry.word))?.word || targetWord;
}

export function solveWithGreedyBot(targetWord, options = {}) {
  const normalizedTarget = normalizeWord(targetWord);
  if (!normalizedTarget) {
    return {
      botPath: [],
      botAttempts: 0,
      botStatus: 'LOST',
    };
  }

  const answerWords = ensureWord(optionWordList(options.answerWords), normalizedTarget);
  const rankingWords = ensureWord(optionWordList(options.rankingWords), normalizedTarget);
  const frequencyConfig = options.frequencyConfig || {};
  const rankCache = options.rankCache;
  const maxAttempts = Number.isFinite(Number(options.maxAttempts))
    ? Number(options.maxAttempts)
    : 6;
  const usedGuesses = new Set();
  const botPath = [];
  let remainingCandidates = answerWords;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remainingBefore = remainingCandidates.length;
    const guess = remainingBefore === 1
      ? remainingCandidates[0]
      : bestUnusedGuess(
        rankWords(remainingCandidates, rankingWords, frequencyConfig, rankCache),
        usedGuesses,
        normalizedTarget,
      );
    const ranking = rankWords(remainingCandidates, rankingWords, frequencyConfig, rankCache);
    const metrics = ranking.find((entry) => entry.word === guess) ||
      { word: guess, ...computeGuessMetrics(guess, remainingCandidates, frequencyConfig) };
    const { observedPattern, candidates, rawRemainingAfter } = nextCandidatePool(
      guess,
      normalizedTarget,
      remainingCandidates,
    );

    usedGuesses.add(guess);
    botPath.push({
      attempt,
      guess,
      pattern: observedPattern,
      remainingBefore,
      remainingAfter: rawRemainingAfter,
      entropy: round(metrics.entropy, 2),
      weightedEntropy: round(metrics.entropy, 2),
      expectedRemaining: round(metrics.expectedRemaining, 1),
      isAnswer: guess === normalizedTarget,
    });

    if (guess === normalizedTarget) {
      return {
        botPath,
        botAttempts: attempt,
        botStatus: 'WON',
      };
    }

    remainingCandidates = candidates;
  }

  return {
    botPath,
    botAttempts: botPath.length,
    botStatus: 'LOST',
  };
}

function verdictFor({ playerSolved, playerAttempts, botStatus, botAttempts }) {
  if (playerSolved && botStatus !== 'WON') {
    return {
      verdict: 'PLAYER_WIN',
      verdictText: 'You beat the bot',
    };
  }

  if (!playerSolved && botStatus === 'WON') {
    return {
      verdict: 'BOT_WIN',
      verdictText: 'Bot wins',
    };
  }

  if (!playerSolved && botStatus !== 'WON') {
    return {
      verdict: 'TIE',
      verdictText: 'Both missed it',
    };
  }

  if (playerAttempts < botAttempts) {
    return {
      verdict: 'PLAYER_WIN',
      verdictText: 'You beat the bot',
    };
  }

  if (playerAttempts > botAttempts) {
    return {
      verdict: 'BOT_WIN',
      verdictText: 'Bot wins',
    };
  }

  return {
    verdict: 'TIE',
    verdictText: 'Tie game',
  };
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

  const answerWords = ensureWord(optionWordList(options.answerWords), normalizedGame.targetWord);
  const rankingWords = ensureWord(optionWordList(options.rankingWords), normalizedGame.targetWord);
  const frequencyConfig = options.frequencyConfig || {};
  const rankCache = options.rankCache;
  let remainingCandidates = answerWords;
  const rows = [];

  for (const guess of normalizedGame.guesses) {
    const remainingBefore = remainingCandidates.length;
    const ranking = rankWords(remainingCandidates, rankingWords, frequencyConfig, rankCache);
    const botChoice = ranking[0] || null;
    const playerRankIndex = ranking.findIndex((entry) => entry.word === guess);
    const playerRank = playerRankIndex >= 0 ? playerRankIndex + 1 : null;
    const playerMetrics = playerRank
      ? ranking[playerRankIndex]
      : { word: guess, ...computeGuessMetrics(guess, remainingCandidates, frequencyConfig) };
    const { observedPattern, candidates, rawRemainingAfter } = nextCandidatePool(
      guess,
      normalizedGame.targetWord,
      remainingCandidates,
    );

    rows.push(formatAnalysisRow({
      attempt: rows.length + 1,
      guess,
      targetWord: normalizedGame.targetWord,
      remainingBefore,
      remainingAfter: rawRemainingAfter,
      observedPattern,
      playerRank,
      rankingLength: ranking.length,
      playerMetrics,
      luckScore: luckScoreForOutcome(playerMetrics, rawRemainingAfter),
      botChoice,
    }));

    remainingCandidates = candidates;
    if (guess === normalizedGame.targetWord) break;
  }

  const finalRow = rows[rows.length - 1] || null;
  const isSolved = rows.some((row) => row.isAnswer);
  const botResult = solveWithGreedyBot(normalizedGame.targetWord, {
    answerWords,
    rankingWords,
    frequencyConfig,
    rankCache,
    maxAttempts: 6,
  });
  const verdict = verdictFor({
    playerSolved: isSolved,
    playerAttempts: rows.length,
    botStatus: botResult.botStatus,
    botAttempts: botResult.botAttempts,
  });

  return {
    ...normalizedGame,
    guesses: rows.map((row) => row.guess),
    guessCount: rows.length,
    initialCandidateCount: answerWords.length,
    rankingWordCount: rankingWords.length,
    finalRemaining: finalRow?.remainingAfter ?? answerWords.length,
    isSolved,
    averageSkill: average(rows.slice(1).map((row) => row.skillScore)),
    averageLuck: average(rows.map((row) => row.luckScore)),
    rows,
    botPath: botResult.botPath,
    botAttempts: botResult.botAttempts,
    botStatus: botResult.botStatus,
    ...verdict,
  };
}
