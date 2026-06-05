import { describe, expect, it } from 'vitest';
import {
  analyzeCompletedDailyGame,
  computeGuessMetrics,
  getWordWeight,
  selectLatestCompletedDailyGame,
  solveWithGreedyBot,
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
  it('applies local heuristic word weights to entropy calculations', () => {
    const equalMetrics = computeGuessMetrics('CRANE', ['CRANE', 'ZESTY'], {
      commonWords: [],
    });
    const weightedMetrics = computeGuessMetrics('CRANE', ['CRANE', 'ZESTY'], {
      commonWords: ['CRANE'],
      commonWordWeight: 4,
      rareLetters: [],
    });

    expect(getWordWeight('CRANE', {
      commonWords: ['CRANE'],
      commonWordWeight: 4,
      rareLetters: [],
    })).toBe(4);
    expect(weightedMetrics.entropy).toBeLessThan(equalMetrics.entropy);
  });

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
      isAnswer: true,
    });
    expect(analysis.rows[1].skillScore).toBeGreaterThanOrEqual(0);
    expect(analysis.averageSkill).toBe(analysis.rows[1].skillScore);
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

  it('excludes one-guess solves from overall skill average', () => {
    const analysis = analyzeCompletedDailyGame(
      {
        status: 'WON',
        targetWord: 'CRANE',
        guesses: ['CRANE'],
      },
      {
        answerWords: ['CRANE', 'TRACE'],
        rankingWords: ['CRANE', 'TRACE'],
      },
    );

    expect(analysis.rows[0].skillScore).toBeGreaterThanOrEqual(0);
    expect(analysis.averageSkill).toBeNull();
  });

  it('adds bot path and a bot-win verdict when the bot solves faster', () => {
    const analysis = analyzeCompletedDailyGame(
      {
        status: 'WON',
        targetWord: 'CRANE',
        guesses: ['TRACE', 'CRANE'],
      },
      {
        answerWords: ['CRANE'],
        rankingWords: ['CRANE', 'TRACE'],
      },
    );

    expect(analysis.botStatus).toBe('WON');
    expect(analysis.botAttempts).toBe(1);
    expect(analysis.botPath[0]).toMatchObject({ guess: 'CRANE', isAnswer: true });
    expect(analysis.verdict).toBe('BOT_WIN');
  });

  it('returns a player-win verdict when the player solves faster than the bot', () => {
    const analysis = analyzeCompletedDailyGame(
      {
        status: 'WON',
        targetWord: 'ZESTY',
        guesses: ['ZESTY'],
      },
      {
        answerWords: ['CRANE', 'ZESTY'],
        rankingWords: ['CRANE', 'ZESTY'],
      },
    );

    expect(analysis.verdict).toBe('PLAYER_WIN');
    expect(analysis.verdictText).toBe('You beat the bot');
  });

  it('returns a tie verdict when player and bot solve in the same number of turns', () => {
    const analysis = analyzeCompletedDailyGame(
      {
        status: 'WON',
        targetWord: 'CRANE',
        guesses: ['CRANE'],
      },
      {
        answerWords: ['CRANE'],
        rankingWords: ['CRANE'],
      },
    );

    expect(analysis.verdict).toBe('TIE');
    expect(analysis.verdictText).toBe('Tie game');
  });
});

describe('solveWithGreedyBot', () => {
  it('solves a one-candidate pool immediately', () => {
    const result = solveWithGreedyBot('CRANE', {
      answerWords: ['CRANE'],
      rankingWords: ['TRACE', 'CRANE'],
    });

    expect(result.botStatus).toBe('WON');
    expect(result.botAttempts).toBe(1);
    expect(result.botPath[0]).toMatchObject({ guess: 'CRANE', isAnswer: true });
  });

  it('stops at the answer and avoids repeated guesses', () => {
    const result = solveWithGreedyBot('CRANE', {
      answerWords: ['CRANE', 'TRACE', 'BRACE', 'BLIMP'],
      rankingWords: ['TRACE', 'CRANE', 'BLIMP', 'BRACE'],
    });
    const guesses = result.botPath.map((row) => row.guess);

    expect(result.botStatus).toBe('WON');
    expect(result.botPath.at(-1).guess).toBe('CRANE');
    expect(new Set(guesses).size).toBe(guesses.length);
    expect(result.botAttempts).toBeLessThanOrEqual(6);
  });
});
