/**
 * useGame — Daily game state machine
 *
 * WBS Tasks 8.3, 8.5, 8.9
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { gameApi } from '../services/api.js';
import { compareWord, isValidGuess, deriveKeyboardStatus } from '../utils/compareWord.js';
import { saveOfflineState, getOfflineState, clearOfflineState } from '../services/guestStorage.js';
import { enqueueSyncRetry } from '../services/syncRetry.js';

const MAX_ATTEMPTS = 6;
const SYNC_DEBOUNCE_MS = 500;

export function useGame({ enabled = true, identityKey = 'guest' } = {}) {
  const [gameId, setGameId] = useState(null);
  const [targetWord, setTargetWord] = useState('');
  const [guessResults, setGuessResults] = useState([]);
  const [submittedWords, setSubmittedWords] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [keyboardStatus, setKeyboardStatus] = useState({});
  const [gameStatus, setGameStatus] = useState('PLAYING');
  const [attempts, setAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedIdentityKey, setLoadedIdentityKey] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const syncTimer = useRef(null);
  const gameIdRef = useRef(null);
  const loadRequestId = useRef(0);
  const toastIdRef = useRef(0);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    window.clearTimeout(toastTimerRef.current);
    setToast({ id, message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  const isProcessingRef = useRef(false);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
  }, []);

  const resetGameState = useCallback(() => {
    setGameId(null);
    setTargetWord('');
    setGuessResults([]);
    setSubmittedWords([]);
    setCurrentGuess('');
    setKeyboardStatus({});
    setGameStatus('PLAYING');
    setAttempts(0);
    setLoadedIdentityKey(null);
    setError(null);
    gameIdRef.current = null;
    isProcessingRef.current = false;
  }, []);

  // Load daily game (Task 8.3)
  const loadGame = useCallback(async () => {
    if (!enabled) return null;

    const requestId = ++loadRequestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await gameApi.getToday();
      if (requestId !== loadRequestId.current) return null;

      const data = res.data;
      const word = atob(data.word);
      setTargetWord(word);
      setGameId(data.id);
      gameIdRef.current = data.id;
      setGameStatus(data.status);
      setAttempts(data.attempts);
      setLoadedIdentityKey(identityKey);
      setCurrentGuess('');

      // Reconcile server state with offline fallback (R9)
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

      const results = reconciledWords.map((w) => compareWord(w, word));
      setSubmittedWords(reconciledWords);
      setGuessResults(results);
      setKeyboardStatus(deriveKeyboardStatus(results));

      if (serverGuesses.length >= (offline?.guesses?.length ?? 0)) {
        clearOfflineState();
      }
    } catch (err) {
      if (requestId !== loadRequestId.current) return null;
      setLoadedIdentityKey(identityKey);
      setError(err.response?.data?.error?.message || "Failed to load today's game");
    } finally {
      if (requestId === loadRequestId.current) setIsLoading(false);
    }
    return null;
  }, [enabled, identityKey, showToast]);

  useEffect(() => {
    if (!enabled) return undefined;

    resetGameState();
    loadGame();

    return () => {
      loadRequestId.current += 1;
    };
  }, [enabled, identityKey, loadGame, resetGameState]);

  // Sync to server (Task 8.5)
  const syncToServer = useCallback((id, words, status) => {
    const dto = { id, guesses: words, status };
    const today = new Date().toISOString().slice(0, 10);
    saveOfflineState(id, words, status, today);

    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await gameApi.sync(dto);
        if (status !== 'PLAYING') clearOfflineState();
      } catch {
        enqueueSyncRetry(dto);
      }
    }, SYNC_DEBOUNCE_MS);
  }, []);

  const handleLetter = useCallback((letter) => {
    if (gameStatus !== 'PLAYING' || currentGuess.length >= 5) return;
    setCurrentGuess((prev) => prev + letter.toUpperCase());
  }, [gameStatus, currentGuess]);

  const handleDelete = useCallback(() => {
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, []);

  const handleEnter = useCallback(() => {
    if (gameStatus !== 'PLAYING' || isProcessingRef.current) return;
    if (currentGuess.length < 5) { showToast('Not enough letters', 'warning'); return; }
    if (!isValidGuess(currentGuess)) { showToast('Not in word list', 'warning'); return; }

    isProcessingRef.current = true;

    const result = compareWord(currentGuess, targetWord);
    const newWords = [...submittedWords, currentGuess];
    const newResults = [...guessResults, result];
    const newKeyboard = deriveKeyboardStatus(newResults);
    const isWon = currentGuess === targetWord;
    const newAttempts = newWords.length;
    const newStatus = isWon ? 'WON' : newAttempts >= MAX_ATTEMPTS ? 'LOST' : 'PLAYING';

    setSubmittedWords(newWords);
    setGuessResults(newResults);
    setKeyboardStatus(newKeyboard);
    setAttempts(newAttempts);
    setCurrentGuess('');
    setGameStatus(newStatus);
    syncToServer(gameIdRef.current, newWords, newStatus);

    setTimeout(() => {
      isProcessingRef.current = false;
    }, 150);
  }, [gameStatus, currentGuess, targetWord, submittedWords, guessResults, showToast, syncToServer]);

  const handleKeyPress = useCallback((key) => {
    if (key === 'ENTER') handleEnter();
    else if (key === 'DELETE' || key === 'BACKSPACE') handleDelete();
    else if (/^[A-Z]$/.test(key)) handleLetter(key);
  }, [handleEnter, handleDelete, handleLetter]);

  const isGameLoading = isLoading || (enabled && loadedIdentityKey !== identityKey);

  return {
    gameId, targetWord, guessResults, submittedWords,
    currentGuess, keyboardStatus, gameStatus, attempts,
    isLoading: isGameLoading, error, toast, showToast, handleKeyPress,
    reloadGame: loadGame,
  };
}
