import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hookState = vi.hoisted(() => ({
  auth: {},
  daily: {},
  practice: {},
  stats: {},
  useGameOptions: null,
}));

vi.mock('../services/syncRetry.js', () => ({
  initSyncRetryService: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => hookState.auth,
}));

vi.mock('../hooks/useGame', () => ({
  useGame: (options) => {
    hookState.useGameOptions = options;
    return hookState.daily;
  },
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
  default: ({ isOpen, wordleBotGame }) => (isOpen ? (
    <div>
      Practice Win Modal
      {wordleBotGame && (
        <span>Practice Bot Game {wordleBotGame.targetWord} {wordleBotGame.status}</span>
      )}
    </div>
  ) : null),
}));

vi.mock('../components/LoseModal', () => ({
  default: ({ isOpen, wordleBotGame }) => (isOpen ? (
    <div>
      Practice Lose Modal
      {wordleBotGame && (
        <span>Practice Bot Game {wordleBotGame.targetWord} {wordleBotGame.status}</span>
      )}
    </div>
  ) : null),
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
    window.localStorage.clear();
    window.localStorage.setItem('wordle:hasSeenHowToPlay', 'true');

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
    hookState.useGameOptions = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
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
    expect(screen.getByText('Practice Bot Game CRANE WON')).toBeInTheDocument();
    expect(screen.queryByText('Daily Results Panel')).not.toBeInTheDocument();
    expect(hookState.practice.showToast).not.toHaveBeenCalled();
  });

  it('passes a completed practice game to the lose modal', async () => {
    render(<App />);

    hookState.practice = {
      ...hookState.practice,
      gameStatus: 'LOST',
      attempts: 6,
      targetWord: 'CRANE',
      submittedWords: ['ADIEU', 'STONY', 'BLIMP', 'SPEED', 'ARRAY', 'EERIE'],
      guessResults: [
        [{ letter: 'A', status: 'present' }],
        [{ letter: 'S', status: 'absent' }],
        [{ letter: 'B', status: 'absent' }],
        [{ letter: 'S', status: 'absent' }],
        [{ letter: 'A', status: 'present' }],
        [{ letter: 'E', status: 'present' }],
      ],
    };

    fireEvent.click(screen.getByRole('tab', { name: 'Practice' }));

    await act(async () => {});

    expect(screen.getByText('Practice Lose Modal')).toBeInTheDocument();
    expect(screen.getByText('Practice Bot Game CRANE LOST')).toBeInTheDocument();
  });

  it('keeps the daily game disabled while auth is bootstrapping', () => {
    hookState.auth = {
      ...hookState.auth,
      isLoading: true,
    };

    render(<App />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(hookState.useGameOptions).toEqual({
      enabled: false,
      identityKey: 'guest',
    });
  });

  it('passes the authenticated user identity to the daily game hook after bootstrap', () => {
    hookState.auth = {
      ...hookState.auth,
      user: {
        id: 'user-1',
        email: 'player@example.com',
        username: 'Player',
      },
      isLoading: false,
    };

    render(<App />);

    expect(hookState.useGameOptions).toEqual({
      enabled: true,
      identityKey: 'user-1',
    });
    expect(screen.getByText('Player')).toBeInTheDocument();
  });

  it('auto-opens the how-to-play guide for first-time visitors and remembers dismissal', async () => {
    vi.useRealTimers();
    window.localStorage.removeItem('wordle:hasSeenHowToPlay');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'How to play' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(window.localStorage.getItem('wordle:hasSeenHowToPlay')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'How to play' })).not.toBeInTheDocument();
  });

  it('opens the how-to-play guide from the header help button', async () => {
    vi.useRealTimers();

    render(<App />);

    expect(screen.queryByRole('heading', { name: 'How to play' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));

    expect(await screen.findByRole('heading', { name: 'How to play' })).toBeInTheDocument();
  });
});
