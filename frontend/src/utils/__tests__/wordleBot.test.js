import { describe, expect, it } from 'vitest';
import {
  analyzeCompletedDailyGame,
  selectLatestCompletedDailyGame,
} from '../wordleBot.js';

describe('selectLatestCompletedDailyGame', () => {
  it('returns the most recent completed game with usable guesses and target word', () => {
    const stats = {
      completedDailyGames: [
        {
          id: 'old-game',
          gameDate: '2026-05-25T00:00:00.000Z',
          completedAt: '2026-05-25T12:00:00.000Z',
          status: 'WON',
          targetWord: 'CRANE',
          guesses: ['TRACE', 'CRANE'],
        },
        {
          id: 'missing-target',
          gameDate: '2026-05-27T00:00:00.000Z',
          completedAt: '2026-05-27T12:00:00.000Z',
          status: 'WON',
          guesses: ['CRANE'],
        },
        {
          id: 'latest-usable',
          gameDate: '2026-05-26T00:00:00.000Z',
          completedAt: '2026-05-26T12:00:00.000Z',
          status: 'LOST',
          targetWord: 'BLIMP',
          guesses: ['CRANE', 'TRACE', 'SPEED', 'CIGAR', 'ARRAY', 'EERIE'],
        },
      ],
    };

    expect(selectLatestCompletedDailyGame(stats)?.id).toBe('latest-usable');
  });

  it('returns null when no completed game has enough data for analysis', () => {
    expect(selectLatestCompletedDailyGame({
      completedDailyGames: [
        { id: 'missing-guesses', status: 'WON', targetWord: 'CRANE', guesses: [] },
        { id: 'playing', status: 'PLAYING', targetWord: 'CRANE', guesses: ['TRACE'] },
      ],
    })).toBeNull();
  });
});

describe('analyzeCompletedDailyGame', () => {
  it('returns null for missing target words or guesses', () => {
    expect(analyzeCompletedDailyGame({ status: 'WON', targetWord: 'CRANE', guesses: [] }))
      .toBeNull();
    expect(analyzeCompletedDailyGame({ status: 'WON', guesses: ['CRANE'] }))
      .toBeNull();
  });

  it('scores guesses, filters candidates, and excludes the opener from average skill', () => {
    const analysis = analyzeCompletedDailyGame(
      {
        id: 'game-1',
        gameDate: '2026-05-27T00:00:00.000Z',
        status: 'WON',
        attempts: 2,
        targetWord: 'CRANE',
        guesses: ['TRACE', 'CRANE'],
      },
      {
        answerWords: ['CRANE', 'TRACE', 'BRACE', 'BLIMP'],
        rankingWords: ['TRACE', 'CRANE', 'BLIMP', 'BRACE'],
      },
    );

    expect(analysis.targetWord).toBe('CRANE');
    expect(analysis.isSolved).toBe(true);
    expect(analysis.rows).toHaveLength(2);
    expect(analysis.rows[0].remainingBefore).toBe(4);
    expect(analysis.rows[0].remainingAfter).toBeGreaterThan(0);
    expect(analysis.rows[0].rankTotal).toBe(4);
    expect(analysis.rows[0].botGuess).toMatch(/^[A-Z]{5}$/);
    expect(analysis.rows[1]).toMatchObject({
      guess: 'CRANE',
      remainingAfter: 1,
      rank: 1,
      skillScore: 99,
      isAnswer: true,
    });
    expect(analysis.averageSkill).toBe(99);
    expect(analysis.averageLuck).toBeGreaterThanOrEqual(0);
    expect(analysis.averageLuck).toBeLessThanOrEqual(99);
  });

  it('adds the target word to the answer pool when historical data is missing it', () => {
    const analysis = analyzeCompletedDailyGame(
      {
        status: 'WON',
        targetWord: 'ZESTY',
        guesses: ['ZESTY'],
      },
      {
        answerWords: ['CRANE'],
        rankingWords: ['CRANE', 'ZESTY'],
      },
    );

    expect(analysis.initialCandidateCount).toBe(2);
    expect(analysis.finalRemaining).toBe(1);
    expect(analysis.rows[0]).toMatchObject({
      guess: 'ZESTY',
      remainingBefore: 2,
      remainingAfter: 1,
      isAnswer: true,
    });
  });

  it('uses duplicate-letter comparison when filtering remaining candidates', () => {
    const analysis = analyzeCompletedDailyGame(
      {
        status: 'LOST',
        completedAt: '2026-05-27T12:00:00.000Z',
        targetWord: 'EERIE',
        guesses: ['SPEED'],
      },
      {
        answerWords: ['EERIE', 'ELATE', 'SPEED', 'ABIED'],
        rankingWords: ['SPEED', 'EERIE', 'ELATE', 'ABIED'],
      },
    );

    expect(analysis.rows[0].pattern).toBe('BBYYB');
    expect(analysis.rows[0].remainingAfter).toBe(2);
  });

  it('analyzes lost games without requiring the answer to appear in guesses', () => {
    const analysis = analyzeCompletedDailyGame(
      {
        status: 'LOST',
        targetWord: 'CRANE',
        guesses: ['BLIMP', 'FUDGY', 'SHOTS', 'WHOMP', 'GODLY', 'PUBIS'],
      },
      {
        answerWords: ['CRANE', 'BLIMP', 'FUDGY', 'SHOTS', 'WHOMP', 'GODLY', 'PUBIS'],
        rankingWords: ['CRANE', 'BLIMP', 'FUDGY', 'SHOTS', 'WHOMP', 'GODLY', 'PUBIS'],
      },
    );

    expect(analysis.status).toBe('LOST');
    expect(analysis.isSolved).toBe(false);
    expect(analysis.rows).toHaveLength(6);
    expect(analysis.finalRemaining).toBeGreaterThanOrEqual(1);
  });
});
