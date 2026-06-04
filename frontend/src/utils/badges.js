import { compareWord } from './compareWord.js';

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clampProgress(value, milestone) {
  if (milestone <= 0) return 0;
  return Math.max(0, Math.min(100, (value / milestone) * 100));
}

function pluralize(value, singular, plural = `${singular}s`) {
  return value === 1 ? singular : plural;
}

function formatBadgeDate(value) {
  if (!value) return 'Earned';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earned';

  return date.toISOString().slice(0, 10);
}

function completedDailyGamesFromStats(stats) {
  if (Array.isArray(stats?.completedDailyGames)) {
    return stats.completedDailyGames;
  }

  if (Array.isArray(stats?.dailyGames)) {
    return stats.dailyGames;
  }

  return [];
}

function dateKey(value) {
  if (!value) return null;

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function normalizeGameStatus(status) {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'WON' || normalized === 'LOST' ? normalized : 'PLAYING';
}

function createDailyGameEntry(dailyGame) {
  const status = normalizeGameStatus(dailyGame?.gameStatus || dailyGame?.status);
  if (status !== 'WON' && status !== 'LOST') return null;

  return {
    id: dailyGame?.gameId || dailyGame?.id,
    gameDate: dailyGame?.gameDate,
    completedAt: dailyGame?.completedAt || dailyGame?.gameDate,
    status,
    attempts: toNumber(dailyGame?.attempts),
    targetWord: dailyGame?.targetWord,
    guesses: Array.isArray(dailyGame?.submittedWords)
      ? dailyGame.submittedWords
      : dailyGame?.guesses,
    guessResults: dailyGame?.guessResults,
  };
}

function matchesDailyGame(game, dailyGame) {
  const dailyGameId = dailyGame?.id || dailyGame?.gameId;
  if (dailyGameId && game?.id && game.id === dailyGameId) return true;

  const gameDate = dateKey(game?.gameDate);
  const dailyDate = dateKey(dailyGame?.gameDate);

  return Boolean(gameDate && dailyDate && gameDate === dailyDate);
}

function statsWithCurrentDailyGame(stats, dailyGame) {
  const dailyEntry = createDailyGameEntry(dailyGame);
  if (!dailyEntry) return stats;

  const completedDailyGames = completedDailyGamesFromStats(stats);
  const alreadyTracked = completedDailyGames.some((game) => matchesDailyGame(game, dailyEntry));
  const guessDistribution = { ...(stats?.guessDistribution || {}) };

  if (dailyEntry.status === 'WON' && dailyEntry.attempts === 1 && !alreadyTracked) {
    guessDistribution['1'] = toNumber(guessDistribution['1']) + 1;
  }

  return {
    ...(stats || {}),
    guessDistribution,
    completedDailyGames: alreadyTracked
      ? completedDailyGames
      : [dailyEntry, ...completedDailyGames],
  };
}

function badgeMap(badges) {
  return new Map(badges.map((badge) => [badge.id, badge]));
}

function currentDailyBadgeIds(dailyGame) {
  const localStats = statsWithCurrentDailyGame(null, dailyGame);
  if (!localStats) return new Set();

  const badges = badgeMap(computeBadges(localStats));
  const ids = new Set();

  if (badges.get('sea-of-greens')?.isEarned) {
    ids.add('sea-of-greens');
  }

  if (badges.get('wordle-in-1')?.isEarned) {
    ids.add('wordle-in-1');
  }

  return ids;
}

function newlyUnlockedBadgeIds(currentBadges, previousStats) {
  if (!previousStats) return new Set();

  const previousBadges = badgeMap(computeBadges(previousStats));
  const ids = new Set();

  currentBadges.forEach((badge) => {
    if (badge.isEarned && !previousBadges.get(badge.id)?.isEarned) {
      ids.add(badge.id);
    }
  });

  return ids;
}

function getGameResults(game) {
  if (Array.isArray(game?.guessResults)) {
    return game.guessResults;
  }

  const guesses = Array.isArray(game?.guesses) ? game.guesses : [];
  const targetWord = game?.targetWord || game?.word || game?.answer;
  if (!targetWord || guesses.length === 0) return [];

  return guesses.map((guess) => compareWord(guess, targetWord));
}

function isYellowStatus(status) {
  return status === 'present' ||
    status === 'yellow' ||
    status === 'Y' ||
    status === '\uD83D\uDFE8';
}

function isNonYellowTile(status) {
  return status === 'correct' ||
    status === 'green' ||
    status === 'G' ||
    status === '\uD83D\uDFE9' ||
    status === 'absent' ||
    status === 'gray' ||
    status === 'grey' ||
    status === 'B' ||
    status === '\u2B1B';
}

function isCompletedGame(game) {
  return game?.status === 'WON' || game?.status === 'LOST' || Boolean(game?.completedAt);
}

function isSeaOfGreensGame(game) {
  if (!isCompletedGame(game)) return false;

  const results = getGameResults(game);
  if (results.length === 0) return false;

  return results.every((row) => (
    Array.isArray(row) &&
    row.length > 0 &&
    row.every((cell) => {
      const status = typeof cell === 'string' ? cell : cell?.status;
      return !isYellowStatus(status) && isNonYellowTile(status);
    })
  ));
}

function seaOfGreensBadge(stats) {
  const earnedGame = completedDailyGamesFromStats(stats).find(isSeaOfGreensGame);
  const isEarned = Boolean(earnedGame);

  return {
    id: 'sea-of-greens',
    name: 'Sea of Greens',
    description: 'Complete a daily puzzle with zero yellow tiles.',
    icon: 'G',
    isEarned,
    progress: isEarned ? 100 : 0,
    progressText: isEarned ? '1/1 no-yellow game' : '0/1 no-yellow games',
    statusText: isEarned
      ? formatBadgeDate(earnedGame.completedAt || earnedGame.gameDate)
      : '0/1',
    earnedAt: earnedGame?.completedAt || earnedGame?.gameDate,
  };
}

function milestoneBadge({
  id,
  name,
  description,
  icon,
  value,
  bestValue,
  milestone,
  unit,
  earnedText,
}) {
  const isEarned = bestValue >= milestone;
  const progressValue = Math.max(0, Math.min(value, milestone));

  return {
    id,
    name,
    description,
    icon,
    isEarned,
    progress: isEarned ? 100 : clampProgress(progressValue, milestone),
    progressText: `${progressValue}/${milestone} ${pluralize(milestone, unit)}`,
    statusText: isEarned ? earnedText : `${progressValue}/${milestone}`,
  };
}

export function computeBadges(stats) {
  const gamesPlayed = toNumber(stats?.gamesPlayed);
  const currentStreak = toNumber(stats?.currentStreak);
  const maxStreak = toNumber(stats?.maxStreak);
  const firstGuessWins = toNumber(stats?.guessDistribution?.['1']);

  const badges = [
    seaOfGreensBadge(stats),
    {
      id: 'wordle-in-1',
      name: 'Wordle In 1',
      description: 'Solve the daily puzzle on your first guess.',
      icon: '1',
      isEarned: firstGuessWins > 0,
      progress: firstGuessWins > 0 ? 100 : 0,
      progressText: `${firstGuessWins}/1 first-guess ${pluralize(firstGuessWins, 'win')}`,
      statusText: firstGuessWins > 0 ? `x${firstGuessWins}` : '0/1',
      count: firstGuessWins,
    },
  ];

  [10, 50, 100].forEach((milestone) => {
    badges.push(milestoneBadge({
      id: `${milestone}-day-streak`,
      name: `${milestone}-Day Streak`,
      description: `Build a ${milestone}-day daily winning streak.`,
      icon: String(milestone),
      value: currentStreak,
      bestValue: maxStreak,
      milestone,
      unit: 'day',
      earnedText: `Best ${maxStreak} ${pluralize(maxStreak, 'day')}`,
    }));
  });

  badges.push(milestoneBadge({
    id: 'dedicated-player',
    name: 'Dedicated Player',
    description: 'Play 100 daily puzzles.',
    icon: 'P',
    value: gamesPlayed,
    bestValue: gamesPlayed,
    milestone: 100,
    unit: 'game',
    earnedText: `${gamesPlayed} ${pluralize(gamesPlayed, 'game')}`,
  }));

  return badges;
}

export function computeDailyBadgeCallouts(stats, dailyGame, previousStats = null) {
  const effectiveStats = statsWithCurrentDailyGame(stats, dailyGame);
  if (!effectiveStats) return [];

  const badges = computeBadges(effectiveStats);
  const calloutIds = new Set([
    ...currentDailyBadgeIds(dailyGame),
    ...newlyUnlockedBadgeIds(badges, previousStats),
  ]);

  return badges.filter((badge) => badge.isEarned && calloutIds.has(badge.id));
}
