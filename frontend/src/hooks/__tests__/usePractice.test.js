import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../data/practiceWords.txt?raw', () => ({
  default: 'CRANE\nADIEU\nSLATE\nSTARE\nTRACE',
}));

import { usePractice } from '../usePractice.js';

function startPractice(result, randomValue = 0) {
  vi.spyOn(Math, 'random').mockReturnValue(randomValue);
  act(() => {
    result.current.startSession();
  });
}

function typeWord(result, word) {
  act(() => {
    for (const letter of word) {
      result.current.handleKeyPress(letter);
    }
  });
}

function submitCurrentGuess(result) {
  act(() => {
    result.current.handleKeyPress('ENTER');
  });
}

describe('usePractice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('startSession sets a 5-letter target word from the practice list', () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);

    expect(result.current.targetWord).toBe('CRANE');
    expect(result.current.targetWord).toHaveLength(5);
  });

  it('startSession generates a unique practiceId', () => {
    const { result } = renderHook(() => usePractice());

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.11)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.22);

    act(() => {
      result.current.startSession();
    });
    const firstId = result.current.practiceId;
    vi.setSystemTime(new Date('2026-05-22T00:00:01Z'));
    act(() => {
      result.current.startSession();
    });

    expect(firstId).toMatch(/^practice-/);
    expect(result.current.practiceId).toMatch(/^practice-/);
    expect(result.current.practiceId).not.toBe(firstId);
  });

  it('startSession resets guesses, keyboard, status, and attempts', () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'ADIEU');
    submitCurrentGuess(result);

    expect(result.current.attempts).toBe(1);

    act(() => {
      result.current.startSession();
    });

    expect(result.current.guessResults).toEqual([]);
    expect(result.current.submittedWords).toEqual([]);
    expect(result.current.currentGuess).toBe('');
    expect(result.current.keyboardStatus).toEqual({});
    expect(result.current.gameStatus).toBe('PLAYING');
    expect(result.current.attempts).toBe(0);
  });

  it("handleKeyPress('A') appends a letter to currentGuess", () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    act(() => {
      result.current.handleKeyPress('A');
    });

    expect(result.current.currentGuess).toBe('A');
  });

  it("handleKeyPress('BACKSPACE') removes the last letter", () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'AB');
    act(() => {
      result.current.handleKeyPress('BACKSPACE');
    });

    expect(result.current.currentGuess).toBe('A');
  });

  it("handleKeyPress('ENTER') with fewer than 5 letters shows a toast", () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'ABC');
    submitCurrentGuess(result);

    expect(result.current.toast).toMatchObject({
      message: 'Not enough letters',
      type: 'warning',
    });
    expect(result.current.toast.id).toEqual(expect.any(Number));
  });

  it("handleKeyPress('ENTER') with an invalid word shows a toast", () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'ZZZZZ');
    submitCurrentGuess(result);

    expect(result.current.toast).toMatchObject({
      message: 'Not in word list',
      type: 'warning',
    });
    expect(result.current.toast.id).toEqual(expect.any(Number));
  });

  it('refreshes the invalid word toast on repeated Enter presses', () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'ZZZZZ');
    submitCurrentGuess(result);
    const firstToastId = result.current.toast.id;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    submitCurrentGuess(result);

    expect(result.current.toast).toMatchObject({
      id: firstToastId + 1,
      message: 'Not in word list',
      type: 'warning',
    });

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.toast).toMatchObject({
      message: 'Not in word list',
      type: 'warning',
    });

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toast).toBeNull();
  });

  it('adds valid guesses to guessResults and updates the keyboard', () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'ADIEU');
    submitCurrentGuess(result);

    expect(result.current.submittedWords).toEqual(['ADIEU']);
    expect(result.current.guessResults).toHaveLength(1);
    expect(result.current.keyboardStatus.A).toBe('present');
    expect(result.current.keyboardStatus.E).toBe('present');
  });

  it('changes gameStatus to WON on a correct guess', () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'CRANE');
    submitCurrentGuess(result);

    expect(result.current.gameStatus).toBe('WON');
    expect(result.current.attempts).toBe(1);
  });

  it('changes gameStatus to LOST after 6 wrong guesses', () => {
    const { result } = renderHook(() => usePractice());
    const guesses = ['ADIEU', 'SLATE', 'STARE', 'TRACE', 'CIGAR', 'SPEED'];

    startPractice(result);
    for (const guess of guesses) {
      typeWord(result, guess);
      submitCurrentGuess(result);
      act(() => {
        vi.advanceTimersByTime(151);
      });
    }

    expect(result.current.gameStatus).toBe('LOST');
    expect(result.current.attempts).toBe(6);
  });

  it('ignores letter and enter keys after game over', () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'CRANE');
    submitCurrentGuess(result);
    act(() => {
      vi.advanceTimersByTime(151);
      result.current.handleKeyPress('A');
      result.current.handleKeyPress('ENTER');
    });

    expect(result.current.gameStatus).toBe('WON');
    expect(result.current.currentGuess).toBe('');
    expect(result.current.submittedWords).toEqual(['CRANE']);
  });

  it('startSession after game over creates a fresh game', () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    typeWord(result, 'CRANE');
    submitCurrentGuess(result);
    act(() => {
      result.current.startSession();
    });

    expect(result.current.gameStatus).toBe('PLAYING');
    expect(result.current.currentGuess).toBe('');
    expect(result.current.submittedWords).toEqual([]);
    expect(result.current.guessResults).toEqual([]);
  });

  it('does not pick the same word twice in a row when the pool has alternatives', () => {
    const { result } = renderHook(() => usePractice());

    startPractice(result);
    const firstWord = result.current.targetWord;
    act(() => {
      result.current.startSession();
    });

    expect(firstWord).toBe('CRANE');
    expect(result.current.targetWord).toBe('ADIEU');
  });
});
