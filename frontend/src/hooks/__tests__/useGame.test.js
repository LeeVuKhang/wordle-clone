import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../useGame.js';
import { gameApi } from '../../services/api.js';
import { clearOfflineState, getOfflineState } from '../../services/guestStorage.js';

vi.mock('../../services/api.js', () => ({
  gameApi: {
    getToday: vi.fn(),
    sync: vi.fn(),
  },
}));

vi.mock('../../services/guestStorage.js', () => ({
  saveOfflineState: vi.fn(),
  getOfflineState: vi.fn(),
  clearOfflineState: vi.fn(),
}));

vi.mock('../../services/syncRetry.js', () => ({
  enqueueSyncRetry: vi.fn(),
}));

function gameResponse(overrides = {}) {
  return {
    data: {
      id: 'game-1',
      word: btoa('CRANE'),
      guesses: [],
      attempts: 0,
      status: 'PLAYING',
      ...overrides,
    },
  };
}

describe('useGame auth gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOfflineState.mockReturnValue(null);
    gameApi.getToday.mockResolvedValue(gameResponse());
  });

  it('does not fetch the daily game while disabled', () => {
    renderHook(() => useGame({ enabled: false, identityKey: 'pending' }));

    expect(gameApi.getToday).not.toHaveBeenCalled();
  });

  it('fetches once auth initialization enables the hook', async () => {
    const { result, rerender } = renderHook(
      ({ enabled, identityKey }) => useGame({ enabled, identityKey }),
      { initialProps: { enabled: false, identityKey: 'guest' } },
    );

    expect(gameApi.getToday).not.toHaveBeenCalled();

    rerender({ enabled: true, identityKey: 'guest' });

    await waitFor(() => expect(result.current.gameId).toBe('game-1'));
    expect(gameApi.getToday).toHaveBeenCalledTimes(1);
  });

  it('reloads cleanly when the active identity changes', async () => {
    gameApi.getToday
      .mockResolvedValueOnce(gameResponse({
        id: 'guest-game',
        guesses: ['ADIEU'],
        attempts: 1,
      }))
      .mockResolvedValueOnce(gameResponse({
        id: 'user-game',
        guesses: ['TRACE'],
        attempts: 1,
      }));

    const { result, rerender } = renderHook(
      ({ identityKey }) => useGame({ enabled: true, identityKey }),
      { initialProps: { identityKey: 'guest' } },
    );

    await waitFor(() => expect(result.current.gameId).toBe('guest-game'));
    expect(result.current.submittedWords).toEqual(['ADIEU']);

    rerender({ identityKey: 'user-1' });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.gameId).toBe('user-game'));
    expect(result.current.submittedWords).toEqual(['TRACE']);
    expect(gameApi.getToday).toHaveBeenCalledTimes(2);
    expect(clearOfflineState).toHaveBeenCalled();
  });
});
