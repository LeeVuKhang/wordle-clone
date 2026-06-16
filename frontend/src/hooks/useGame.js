/**
 * useGame - Daily game state machine
 *
 * WBS Tasks 8.3, 8.5, 8.9
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { gameApi } from '../services/api.js';
import { compareWord, isValidGuess, deriveKeyboardStatus } from '../utils/compareWord.js';
import { GUESS_REVEAL_DURATION_MS } from '../utils/revealTiming.js';
import { saveOfflineState, getOfflineState, clearOfflineState } from '../services/guestStorage.js';
import { enqueueSyncRetry } from '../services/syncRetry.js';

const MAX_ATTEMPTS = 6;
const SYNC_DEBOUNCE_MS = 500;

function createInitialGameState(identityKey, isLoading = true) {
  return {
    identityKey,
    gameId: null,
    targetWord: '',
    guessResults: [],
    submittedWords: [],
    currentGuess: '',
    keyboardStatus: {},
    gameStatus: 'PLAYING',
    attempts: 0,
    isLoading,
    isRevealing: false,
    loadedIdentityKey: null,
    error: null,
  };
}

function gameReducer(state, action) {
  switch (action.type) {
    case 'identity_changed':
      return createInitialGameState(action.identityKey, action.enabled);
    case 'load_started':
      return {
        ...state,
        isLoading: true,
        isRevealing: false,
        error: null,
      };
    case 'load_succeeded':
      return {
        ...state,
        gameId: action.gameId,
        targetWord: action.targetWord,
        guessResults: action.guessResults,
        submittedWords: action.submittedWords,
        currentGuess: '',
        keyboardStatus: action.keyboardStatus,
        gameStatus: action.gameStatus,
        attempts: action.attempts,
        isLoading: false,
        isRevealing: false,
        loadedIdentityKey: action.identityKey,
        error: null,
      };
    case 'load_failed':
      return {
        ...state,
        isLoading: false,
        isRevealing: false,
        loadedIdentityKey: action.identityKey,
        error: action.error,
      };
    case 'append_letter':
      return {
        ...state,
        currentGuess: `${state.currentGuess}${action.letter.toUpperCase()}`,
      };
    case 'delete_letter':
      return {
        ...state,
        currentGuess: state.currentGuess.slice(0, -1),
      };
    case 'guess_submitted':
      return {
        ...state,
        submittedWords: action.submittedWords,
        guessResults: action.guessResults,
        keyboardStatus: action.keyboardStatus,
        attempts: action.attempts,
        currentGuess: '',
        gameStatus: action.gameStatus,
        isRevealing: true,
      };
    case 'reveal_finished':
      return {
        ...state,
        isRevealing: false,
      };
    default:
      return state;
  }
}

export function useGame({ enabled = true, identityKey = 'guest' } = {}) {
  const [state, dispatch] = useReducer(
    gameReducer,
    { enabled, identityKey },
    ({ enabled: initialEnabled, identityKey: initialIdentityKey }) => (
      createInitialGameState(initialIdentityKey, initialEnabled)
    ),
  );

  if (state.identityKey !== identityKey) {
    dispatch({ type: 'identity_changed', identityKey, enabled });
  }

  const syncTimer = useRef(null);
  const gameIdRef = useRef(null);
  const loadRequestId = useRef(0);
  const toastIdRef = useRef(0);
  const toastTimerRef = useRef(null);
  const revealTimerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    window.clearTimeout(toastTimerRef.current);
    setToast({ id, message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  const cancelActiveLoad = useCallback(() => {
    loadRequestId.current += 1;
  }, []);

  useEffect(() => () => {
    window.clearTimeout(syncTimer.current);
    window.clearTimeout(toastTimerRef.current);
    window.clearTimeout(revealTimerRef.current);
  }, []);

  const loadGame = useCallback(async () => {
    if (!enabled) return null;

    const requestId = ++loadRequestId.current;
    window.clearTimeout(revealTimerRef.current);
    gameIdRef.current = null;
    isProcessingRef.current = false;
    dispatch({ type: 'load_started' });

    try {
      const res = await gameApi.getToday();
      if (requestId !== loadRequestId.current) return null;

      const data = res.data;
      const word = atob(data.word);
      const offline = getOfflineState();
      const serverGuesses = data.guesses || [];
      let reconciledWords = serverGuesses;

      if (
        offline &&
        offline.gameId === data.id &&
        offline.guesses.length > serverGuesses.length &&
        data.status === 'PLAYING'
      ) {
        reconciledWords = offline.guesses;
        showToast('Progress restored from offline storage', 'info');
      }

      const guessResults = reconciledWords.map((guess) => compareWord(guess, word));

      gameIdRef.current = data.id;
      dispatch({
        type: 'load_succeeded',
        identityKey,
        gameId: data.id,
        targetWord: word,
        gameStatus: data.status,
        attempts: data.attempts,
        submittedWords: reconciledWords,
        guessResults,
        keyboardStatus: deriveKeyboardStatus(guessResults),
      });

      if (serverGuesses.length >= (offline?.guesses?.length ?? 0)) {
        clearOfflineState();
      }
    } catch (err) {
      if (requestId !== loadRequestId.current) return null;
      dispatch({
        type: 'load_failed',
        identityKey,
        error: err.response?.data?.error?.message || "Failed to load today's game",
      });
    }

    return null;
  }, [enabled, identityKey, showToast]);

  useEffect(() => {
    if (!enabled) return undefined;

    void loadGame();
    return cancelActiveLoad;
  }, [cancelActiveLoad, enabled, identityKey, loadGame]);

  const syncToServer = useCallback((id, words, status) => {
    const dto = { id, guesses: words, status };
    const today = new Date().toISOString().slice(0, 10);
    saveOfflineState(id, words, status, today);

    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(async () => {
      try {
        await gameApi.sync(dto);
        if (status !== 'PLAYING') clearOfflineState();
      } catch {
        enqueueSyncRetry(dto);
      }
    }, SYNC_DEBOUNCE_MS);
  }, []);

  const {
    gameId,
    targetWord,
    guessResults,
    submittedWords,
    currentGuess,
    keyboardStatus,
    gameStatus,
    attempts,
    isLoading,
    isRevealing,
    loadedIdentityKey,
    error,
  } = state;

  const handleLetter = useCallback((letter) => {
    if (gameStatus !== 'PLAYING' || isProcessingRef.current || currentGuess.length >= 5) return;
    dispatch({ type: 'append_letter', letter });
  }, [currentGuess, gameStatus]);

  const handleDelete = useCallback(() => {
    if (gameStatus !== 'PLAYING' || isProcessingRef.current) return;
    dispatch({ type: 'delete_letter' });
  }, [gameStatus]);

  const handleEnter = useCallback(() => {
    if (gameStatus !== 'PLAYING' || isProcessingRef.current) return;
    if (currentGuess.length < 5) {
      showToast('Not enough letters', 'warning');
      return;
    }
    if (!isValidGuess(currentGuess)) {
      showToast('Not in word list', 'warning');
      return;
    }

    isProcessingRef.current = true;

    const result = compareWord(currentGuess, targetWord);
    const newWords = [...submittedWords, currentGuess];
    const newResults = [...guessResults, result];
    const newKeyboard = deriveKeyboardStatus(newResults);
    const isWon = currentGuess === targetWord;
    const newAttempts = newWords.length;
    const newStatus = isWon ? 'WON' : newAttempts >= MAX_ATTEMPTS ? 'LOST' : 'PLAYING';

    dispatch({
      type: 'guess_submitted',
      submittedWords: newWords,
      guessResults: newResults,
      keyboardStatus: newKeyboard,
      attempts: newAttempts,
      gameStatus: newStatus,
    });
    syncToServer(gameIdRef.current, newWords, newStatus);

    window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => {
      isProcessingRef.current = false;
      dispatch({ type: 'reveal_finished' });
    }, GUESS_REVEAL_DURATION_MS);
  }, [
    currentGuess,
    gameStatus,
    guessResults,
    showToast,
    submittedWords,
    syncToServer,
    targetWord,
  ]);

  const handleKeyPress = useCallback((key) => {
    if (key === 'ENTER') handleEnter();
    else if (key === 'DELETE' || key === 'BACKSPACE') handleDelete();
    else if (/^[A-Z]$/.test(key)) handleLetter(key);
  }, [handleDelete, handleEnter, handleLetter]);

  const isGameLoading = enabled && (isLoading || loadedIdentityKey !== identityKey);

  return {
    gameId,
    targetWord,
    guessResults,
    submittedWords,
    currentGuess,
    keyboardStatus,
    gameStatus,
    attempts,
    isLoading: isGameLoading,
    isRevealing,
    error,
    toast,
    showToast,
    handleKeyPress,
    reloadGame: loadGame,
  };
}
