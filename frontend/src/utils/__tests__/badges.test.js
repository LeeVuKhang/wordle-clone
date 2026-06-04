import { describe, expect, it } from 'vitest';
import { computeBadges, computeDailyBadgeCallouts } from '../badges.js';

describe('computeBadges', () => {
  it('marks first-guess and streak badges as earned from stats', () => {
    const badges = computeBadges({
      gamesPlayed: 60,
      gamesWon: 54,
      winPercentage: 90,
      currentStreak: 12,
      maxStreak: 50,
      guessDistribution: { 1: 2 },
    });

    expect(badges.find((badge) => badge.id === 'wordle-in-1')).toMatchObject({
      isEarned: true,
      statusText: 'x2',
    });
    expect(badges.find((badge) => badge.id === '10-day-streak')?.isEarned).toBe(true);
    expect(badges.find((badge) => badge.id === '50-day-streak')?.isEarned).toBe(true);
    expect(badges.find((badge) => badge.id === '100-day-streak')?.isEarned).toBe(false);
  });

  it('does not earn Sea of Greens from win totals alone', () => {
    const badges = computeBadges({
      gamesPlayed: 60,
      gamesWon: 54,
      winPercentage: 90,
      currentStreak: 12,
      maxStreak: 50,
      guessDistribution: { 1: 2 },
    });

    expect(badges.find((badge) => badge.id === 'sea-of-greens')).toMatchObject({
      isEarned: false,
      progressText: '0/1 no-yellow games',
      statusText: '0/1',
    });
  });

  it('earns Sea of Greens for a completed daily game with no yellow tiles', () => {
    const badges = computeBadges({
      gamesPlayed: 1,
      gamesWon: 1,
      winPercentage: 100,
      currentStreak: 1,
      maxStreak: 1,
      guessDistribution: { 1: 1 },
      completedDailyGames: [
        {
          gameDate: '2026-05-27T00:00:00.000Z',
          completedAt: '2026-05-27T12:00:00.000Z',
          status: 'WON',
          targetWord: 'CRANE',
          guesses: ['BLIMP', 'CRANE'],
        },
      ],
    });

    expect(badges.find((badge) => badge.id === 'sea-of-greens')).toMatchObject({
      isEarned: true,
      progress: 100,
      progressText: '1/1 no-yellow game',
      statusText: '2026-05-27',
    });
  });

  it('does not earn Sea of Greens when any completed row contains yellow', () => {
    const badges = computeBadges({
      gamesPlayed: 1,
      gamesWon: 1,
      winPercentage: 100,
      currentStreak: 1,
      maxStreak: 1,
      guessDistribution: { 1: 1 },
      completedDailyGames: [
        {
          gameDate: '2026-05-27T00:00:00.000Z',
          completedAt: '2026-05-27T12:00:00.000Z',
          status: 'WON',
          targetWord: 'CRANE',
          guesses: ['TRACE', 'CRANE'],
        },
      ],
    });

    expect(badges.find((badge) => badge.id === 'sea-of-greens')?.isEarned).toBe(false);
  });

  it('earns Sea of Greens for a completed loss with no yellow tiles', () => {
    const badges = computeBadges({
      gamesPlayed: 1,
      gamesWon: 0,
      winPercentage: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { 1: 0 },
      completedDailyGames: [
        {
          gameDate: '2026-05-27T00:00:00.000Z',
          completedAt: '2026-05-27T12:00:00.000Z',
          status: 'LOST',
          targetWord: 'CRANE',
          guesses: ['BLIMP', 'FUDGY', 'SHOTS', 'WHOMP', 'GODLY', 'PUBIS'],
        },
      ],
    });

    expect(badges.find((badge) => badge.id === 'sea-of-greens')?.isEarned).toBe(true);
  });

  it('reports progress for unearned badges', () => {
    const badges = computeBadges({
      gamesPlayed: 25,
      gamesWon: 5,
      winPercentage: 20,
      currentStreak: 7,
      maxStreak: 7,
      guessDistribution: { 1: 0 },
    });

    expect(badges.find((badge) => badge.id === '10-day-streak')).toMatchObject({
      isEarned: false,
      progress: 70,
      progressText: '7/10 days',
    });
    expect(badges.find((badge) => badge.id === 'dedicated-player')).toMatchObject({
      isEarned: false,
      progress: 25,
      progressText: '25/100 games',
    });
  });

  it('calls out Sea of Greens and Wordle In 1 for the just-finished daily game', () => {
    const callouts = computeDailyBadgeCallouts(null, {
      gameId: 'daily-1',
      gameDate: '2026-05-27',
      gameStatus: 'WON',
      attempts: 1,
      guessResults: [
        [
          { letter: 'C', status: 'correct' },
          { letter: 'R', status: 'correct' },
          { letter: 'A', status: 'correct' },
          { letter: 'N', status: 'correct' },
          { letter: 'E', status: 'correct' },
        ],
      ],
    });

    expect(callouts.map((badge) => badge.id)).toEqual([
      'sea-of-greens',
      'wordle-in-1',
    ]);
  });

  it('calls out badges newly unlocked by refreshed daily stats', () => {
    const previousStats = {
      gamesPlayed: 9,
      gamesWon: 9,
      winPercentage: 100,
      currentStreak: 9,
      maxStreak: 9,
      guessDistribution: { 1: 0 },
    };

    const currentStats = {
      gamesPlayed: 10,
      gamesWon: 10,
      winPercentage: 100,
      currentStreak: 10,
      maxStreak: 10,
      guessDistribution: { 1: 0 },
      completedDailyGames: [
        {
          id: 'daily-10',
          gameDate: '2026-05-28T00:00:00.000Z',
          completedAt: '2026-05-28T12:00:00.000Z',
          status: 'WON',
          targetWord: 'CRANE',
          guesses: ['TRACE', 'CRANE'],
        },
      ],
    };

    const callouts = computeDailyBadgeCallouts(currentStats, {
      gameId: 'daily-10',
      gameDate: '2026-05-28',
      gameStatus: 'WON',
      attempts: 2,
    }, previousStats);

    expect(callouts.map((badge) => badge.id)).toEqual(['10-day-streak']);
  });
});
