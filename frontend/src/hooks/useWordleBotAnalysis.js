import { useCallback, useEffect, useRef, useState } from 'react';

const EMPTY_STATE = {
  status: 'idle',
  progressStage: null,
  analysis: null,
  error: null,
};

function gameKey(game) {
  if (!game) return null;

  return [
    game.id || game.gameId || '',
    game.gameDate || game.date || '',
    game.completedAt || '',
    game.status || game.gameStatus || '',
    game.targetWord || game.word || game.answer || '',
    Array.isArray(game.guesses) ? game.guesses.join(',') : '',
    Array.isArray(game.submittedWords) ? game.submittedWords.join(',') : '',
  ].join('|');
}

async function fallbackAnalyze(game) {
  const [
    wordleBotModule,
    practiceWordsModule,
    validGuessesModule,
    frequencyConfigModule,
  ] = await Promise.all([
    import('../utils/wordleBot.js'),
    import('../data/practiceWords.txt?raw'),
    import('../data/validGuesses.json'),
    import('../data/wordFrequencies.json'),
  ]);

  const answerWords = practiceWordsModule.default
    .split(/\r?\n/)
    .flatMap((word) => {
      const trimmed = word.trim();
      return trimmed ? [trimmed] : [];
    });
  const analysis = wordleBotModule.analyzeCompletedDailyGame(game, {
    answerWords,
    rankingWords: validGuessesModule.default,
    frequencyConfig: frequencyConfigModule.default,
    rankCache: new Map(),
  });

  if (!analysis) {
    throw new Error('No completed game is ready for analysis.');
  }

  return analysis;
}

export function useWordleBotAnalysis() {
  const [state, setState] = useState(EMPTY_STATE);
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(null);
  if (!cacheRef.current) {
    cacheRef.current = new Map();
  }

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setState(EMPTY_STATE);
  }, []);

  const analyze = useCallback(async (game) => {
    const key = gameKey(game);
    if (!key) {
      setState({
        ...EMPTY_STATE,
        status: 'error',
        error: 'No completed game is ready for analysis.',
      });
      return null;
    }

    if (cacheRef.current.has(key)) {
      const analysis = cacheRef.current.get(key);
      setState({
        status: 'ready',
        progressStage: null,
        analysis,
        error: null,
      });
      return analysis;
    }

    const requestId = `${Date.now()}-${requestIdRef.current + 1}`;
    requestIdRef.current += 1;

    setState({
      status: 'loading',
      progressStage: 'Preparing analysis',
      analysis: null,
      error: null,
    });

    if (typeof Worker !== 'undefined') {
      try {
        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL('../workers/wordleBot.worker.js', import.meta.url),
            { type: 'module' },
          );
        }

        return await new Promise((resolve, reject) => {
          const worker = workerRef.current;

          worker.onmessage = (event) => {
            const message = event.data || {};
            if (message.requestId !== requestId) return;

            if (message.type === 'analysis-progress') {
              setState((current) => ({
                ...current,
                status: 'loading',
                progressStage: message.stage,
              }));
              return;
            }

            if (message.type === 'analysis-complete') {
              cacheRef.current.set(key, message.analysis);
              setState({
                status: 'ready',
                progressStage: null,
                analysis: message.analysis,
                error: null,
              });
              resolve(message.analysis);
              return;
            }

            if (message.type === 'analysis-error') {
              setState({
                status: 'error',
                progressStage: null,
                analysis: null,
                error: message.error || 'Unable to analyze this completed game.',
              });
              reject(new Error(message.error));
            }
          };

          worker.onerror = (event) => {
            const message = event?.message || 'Unable to analyze this completed game.';
            setState({
              status: 'error',
              progressStage: null,
              analysis: null,
              error: message,
            });
            reject(new Error(message));
          };

          worker.postMessage({
            type: 'analyze-game',
            requestId,
            game,
          });
        });
      } catch {
        workerRef.current?.terminate();
        workerRef.current = null;
      }
    }

    try {
      setState((current) => ({
        ...current,
        status: 'loading',
        progressStage: 'Running analysis',
      }));
      const analysis = await fallbackAnalyze(game);
      cacheRef.current.set(key, analysis);
      setState({
        status: 'ready',
        progressStage: null,
        analysis,
        error: null,
      });
      return analysis;
    } catch (err) {
      setState({
        status: 'error',
        progressStage: null,
        analysis: null,
        error: err?.message || 'Unable to analyze this completed game.',
      });
      return null;
    }
  }, []);

  return {
    ...state,
    analyze,
    reset,
  };
}
