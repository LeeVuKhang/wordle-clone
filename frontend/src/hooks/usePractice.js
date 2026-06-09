/**
 * usePractice - Practice mode state machine (client-side only)
 *
 * WBS Tasks 8.7, 6B
 * No streak impact, no server calls, no Redis session.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import PRACTICE_WORDS_TEXT from '../data/practiceWords.txt?raw';
import { compareWord, deriveKeyboardStatus, isValidGuess } from '../utils/compareWord.js';
import { GUESS_REVEAL_DURATION_MS } from '../utils/revealTiming.js';

const MAX_ATTEMPTS = 6;
const PRACTICE_WORDS = [...new Set(
  PRACTICE_WORDS_TEXT
    .split(/\r?\n/)
    .map((word) => word.toUpperCase())
    .filter((word) => /^[A-Z]{5}$/.test(word))
)];

function pickRandomWord(previousWord = null) {
  if (PRACTICE_WORDS.length === 0) {
    throw new Error('No practice words found in practiceWords.txt');
  }

  const index = Math.floor(Math.random() * PRACTICE_WORDS.length);
  const word = PRACTICE_WORDS[index];

  if (PRACTICE_WORDS.length > 1 && word === previousWord) {
    return PRACTICE_WORDS[(index + 1) % PRACTICE_WORDS.length];
  }

  return word;
}

export function usePractice() {
  const [practiceId, setPracticeId] = useState(null);
  const [targetWord, setTargetWord] = useState('');
  const [guessResults, setGuessResults] = useState([]);
  const [submittedWords, setSubmittedWords] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [keyboardStatus, setKeyboardStatus] = useState({});
  const [gameStatus, setGameStatus] = useState('PLAYING');
  const [attempts, setAttempts] = useState(0);
  const [isLoading] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const targetWordRef = useRef('');
  const isProcessingRef = useRef(false);
  const toastIdRef = useRef(0);
  const toastTimerRef = useRef(null);
  const revealTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    window.clearTimeout(toastTimerRef.current);
    setToast({ id, message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
    window.clearTimeout(revealTimerRef.current);
  }, []);

  const startSession = useCallback(() => {
    setError(null);
    try {
      const word = pickRandomWord(targetWordRef.current);
      targetWordRef.current = word;
      setPracticeId(`practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      setTargetWord(word);
      setGuessResults([]);
      setSubmittedWords([]);
      setCurrentGuess('');
      setKeyboardStatus({});
      setGameStatus('PLAYING');
      setAttempts(0);
      setIsRevealing(false);
      isProcessingRef.current = false;
      window.clearTimeout(revealTimerRef.current);
    } catch (err) {
      setError(err.message || 'Failed to start practice session');
    }
  }, []);

  const handleLetter = useCallback((letter) => {
    if (gameStatus !== 'PLAYING' || isProcessingRef.current || currentGuess.length >= 5) return;
    setCurrentGuess((prev) => prev + letter.toUpperCase());
  }, [gameStatus, currentGuess]);

  const handleDelete = useCallback(() => {
    if (gameStatus !== 'PLAYING' || isProcessingRef.current) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [gameStatus]);

  const handleEnter = useCallback(() => {
    if (gameStatus !== 'PLAYING' || !targetWord || isProcessingRef.current) return;
    if (currentGuess.length < 5) { showToast('Not enough letters', 'warning'); return; }
    if (!isValidGuess(currentGuess)) { showToast('Not in word list', 'warning'); return; }

    isProcessingRef.current = true;
    setIsRevealing(true);

    const normalizedGuess = currentGuess.toUpperCase();
    const result = compareWord(normalizedGuess, targetWord);
    const newWords = [...submittedWords, normalizedGuess];
    const newResults = [...guessResults, result];
    const newAttempts = newWords.length;
    const isWon = normalizedGuess === targetWord;
    const newStatus = isWon ? 'WON' : newAttempts >= MAX_ATTEMPTS ? 'LOST' : 'PLAYING';

    setGuessResults(newResults);
    setSubmittedWords(newWords);
    setKeyboardStatus(deriveKeyboardStatus(newResults));
    setAttempts(newAttempts);
    setCurrentGuess('');
    setGameStatus(newStatus);

    window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => {
      isProcessingRef.current = false;
      setIsRevealing(false);
    }, GUESS_REVEAL_DURATION_MS);
  }, [gameStatus, targetWord, currentGuess, submittedWords, guessResults, showToast]);

  const handleKeyPress = useCallback((key) => {
    if (key === 'ENTER') handleEnter();
    else if (key === 'DELETE' || key === 'BACKSPACE') handleDelete();
    else if (/^[A-Z]$/.test(key)) handleLetter(key);
  }, [handleEnter, handleDelete, handleLetter]);

  return {
    practiceId, targetWord, guessResults, submittedWords,
    currentGuess, keyboardStatus, gameStatus, attempts,
    isLoading, isRevealing, error, toast, showToast,
    startSession, handleKeyPress,
  };
}
