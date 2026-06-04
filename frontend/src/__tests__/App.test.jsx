import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hookState = vi.hoisted(() => ({
  auth: {},
  daily: {},
  practice: {},
  stats: {},
}));

vi.mock('../services/syncRetry.js', () => ({
  initSyncRetryService: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => hookState.auth,
}));

vi.mock('../hooks/useGame', () => ({
  useGame: () => hookState.daily,
}));

vi.mock('../hooks/usePractice', () => ({
  usePractice: () => hookState.practice,
}));

vi.mock('../hooks/useStats', () => ({
  useStats: () => hookState.stats,
}));

vi.mock('../components/ResultsPanel', () => ({
  default: ({ isOpen }) => (isOpen ? <div>Daily Results Panel</div> : null),
}));

vi.mock('../components/WinModal', () => ({
  default: ({ isOpen }) => (isOpen ? <div>Practice Win Modal</div> : null),
}));

vi.mock('../components/LoseModal', () => ({
  default: ({ isOpen }) => (isOpen ? <div>Practice Lose Modal</div> : null),
}));

import App from '../App.jsx';

function createGameState(overrides = {}) {
  return {
    gameId: 'daily-1',
    targetWord: 'CRANE',
    guessResults: [],
    submittedWords: [],
    currentGuess: '',
    keyboardStatus: {},
    gameStatus: 'PLAYING',
    attempts: 0,
    isLoading: false,
    error: null,
    toast: null,
    showToast: vi.fn(),
    handleKeyPress: vi.fn(),
    reloadGame: vi.fn(),
    ...overrides,
  };
}

function createStatsState(overrides = {}) {
  return {
    stats: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('App daily completion flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    hookState.auth = {
      user: null,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    };
    hookState.daily = createGameState();
    hookState.practice = createGameState({
      gameId: 'practice-1',
      practiceId: 'practice-1',
      startSession: vi.fn(),
    });
    hookState.stats = createStatsState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a daily completion toast and auto-opens results after two seconds', async () => {
    const { rerender } = render(<App />);

    hookState.daily = {
      ...hookState.daily,
      gameStatus: 'WON',
      attempts: 4,
      submittedWords: ['ADIEU', 'STONY', 'BLIMP', 'CRANE'],
      guessResults: [
        [{ letter: 'A', status: 'present' }],
        [{ letter: 'S', status: 'absent' }],
        [{ letter: 'B', status: 'absent' }],
        [{ letter: 'C', status: 'correct' }],
      ],
    };

    rerender(<App />);

    expect(hookState.daily.showToast).toHaveBeenCalledWith('Splendid', 'success');
    expect(screen.queryByText('Daily Results Panel')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {});

    expect(screen.getByText('Daily Results Panel')).toBeInTheDocument();
  });

  it('does not auto-open daily results for practice completion', async () => {
    render(<App />);

    hookState.practice = {
      ...hookState.practice,
      gameStatus: 'WON',
      attempts: 3,
      submittedWords: ['ADIEU', 'STONY', 'CRANE'],
      guessResults: [
        [{ letter: 'A', status: 'present' }],
        [{ letter: 'S', status: 'absent' }],
        [{ letter: 'C', status: 'correct' }],
      ],
    };

    fireEvent.click(screen.getByRole('tab', { name: 'Practice' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    await act(async () => {});

    expect(screen.getByText('Practice Win Modal')).toBeInTheDocument();
    expect(screen.queryByText('Daily Results Panel')).not.toBeInTheDocument();
    expect(hookState.practice.showToast).not.toHaveBeenCalled();
  });
});
