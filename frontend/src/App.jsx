import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';

import Header    from './components/Header';
import GameBoard from './components/GameBoard';
import Keyboard  from './components/Keyboard';
import Toast     from './components/Toast';

import { useAuth }     from './hooks/useAuth';
import { useGame }     from './hooks/useGame';
import { usePractice } from './hooks/usePractice';
import { useStats }    from './hooks/useStats';
import { initSyncRetryService } from './services/syncRetry.js';

import './App.css';

// Lazy-loaded modals (not needed on initial render)
const AuthModal = lazy(() => import('./components/AuthModal'));
const WinModal = lazy(() => import('./components/WinModal'));
const LoseModal = lazy(() => import('./components/LoseModal'));
const StatsModal = lazy(() => import('./components/StatsModal'));
const LeaderboardModal = lazy(() => import('./components/LeaderboardModal'));
const ResultsPanel = lazy(() => import('./components/ResultsPanel'));

// Initialise retry queue listener once at module level
initSyncRetryService();

// ─── OAuth callback handler ───────────────────────────────────────────────────
/**
 * If the current URL contains ?code=..., we are on the OAuth redirect-back page.
 * Extract the code and return it (cleared from the URL), otherwise return null.
 */
const DAILY_WIN_MESSAGES = [
  'Genius',
  'Magnificent',
  'Impressive',
  'Splendid',
  'Great',
  'Phew',
];

function getDailyCompletionMessage(gameStatus, attempts) {
  if (gameStatus === 'WON') {
    return DAILY_WIN_MESSAGES[Math.max(0, Math.min(5, Number(attempts || 1) - 1))];
  }

  if (gameStatus === 'LOST') {
    return 'Nice try';
  }

  return null;
}

function consumeOAuthCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    // Clean up URL without a page reload — redirect to root instead of staying on /auth/callback
    window.history.replaceState({}, document.title, '/');
    return code;
  }
  return null;
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [mode, setMode]               = useState('daily');   // 'daily' | 'practice'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showResultsPanel, setShowResultsPanel] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [completionStatsSnapshot, setCompletionStatsSnapshot] = useState(null);
  const [shouldRefreshMergedState, setShouldRefreshMergedState] = useState(false);
  const latestStatsRef = useRef(null);
  const previousDailyStatusRef = useRef('PLAYING');
  const previousDailyLoadingRef = useRef(true);

  const auth     = useAuth();
  const daily    = useGame({
    enabled: !auth.isLoading,
    identityKey: auth.user?.id ?? 'guest',
  });
  const practice = usePractice();
  const {
    stats,
    isLoading: isStatsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useStats(auth.user);

  // Active game depends on mode
  const game = mode === 'daily' ? daily : practice;
  const dailyGameDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    latestStatsRef.current = stats;
  }, [stats]);

  // ── Handle OAuth redirect-back ─────────────────────────────────────────
  useEffect(() => {
    const code = consumeOAuthCode();
    if (!code) return;
    const redirectUri =
      import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`;

    auth.login(code, redirectUri).then((data) => {
      if (data?.mergeResult) {
        setMergeResult(data.mergeResult);
        setShowAuthModal(true);   // show merge success modal
        setShouldRefreshMergedState(true);
      }
    }).catch(() => {
      // auth.error is set inside the hook
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shouldRefreshMergedState || !auth.user) return;

    daily.reloadGame();
    refetchStats();
    setShouldRefreshMergedState(false);
  }, [shouldRefreshMergedState, auth.user, daily.reloadGame, refetchStats]);

  // ── Start practice session when switching to practice mode ────────────
  useEffect(() => {
    if (mode === 'practice' && !practice.practiceId) {
      practice.startSession();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Physical keyboard ─────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.repeat) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key.toUpperCase();
      if (key === 'ENTER')     game.handleKeyPress('ENTER');
      else if (key === 'BACKSPACE') { e.preventDefault(); game.handleKeyPress('BACKSPACE'); }
      else if (/^[A-Z]$/.test(key)) game.handleKeyPress(key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game.handleKeyPress]);

  // ── Modal derived state ───────────────────────────────────────────────
  const isGameOver = game.gameStatus === 'WON' || game.gameStatus === 'LOST';
  const isWon      = game.gameStatus === 'WON';

  useEffect(() => {
    if (game.gameStatus === 'PLAYING') setModalDismissed(false);
  }, [game.gameStatus]);

  useEffect(() => {
    if (daily.gameStatus === 'PLAYING') {
      setCompletionStatsSnapshot(null);
    }
  }, [daily.gameStatus]);

  useEffect(() => {
    const wasDailyPlaying = previousDailyStatusRef.current === 'PLAYING';
    const wasDailyLoaded = previousDailyLoadingRef.current === false;
    const isDailyGameOver = daily.gameStatus === 'WON' || daily.gameStatus === 'LOST';

    previousDailyStatusRef.current = daily.gameStatus;
    previousDailyLoadingRef.current = daily.isLoading;

    if (
      mode !== 'daily' ||
      daily.isLoading ||
      !wasDailyLoaded ||
      !wasDailyPlaying ||
      !isDailyGameOver
    ) {
      return undefined;
    }

    const message = getDailyCompletionMessage(daily.gameStatus, daily.attempts);
    setCompletionStatsSnapshot(latestStatsRef.current);

    if (message) {
      daily.showToast(message, 'success');
    }

    const timer = window.setTimeout(() => {
      setShowResultsPanel(true);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [daily.attempts, daily.gameStatus, daily.isLoading, daily.showToast, mode, showResultsPanel]);

  useEffect(() => {
    if (mode !== 'daily' || !auth.user || !isGameOver) return undefined;

    const timer = window.setTimeout(() => {
      refetchStats();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [mode, auth.user, isGameOver, daily.gameStatus, daily.attempts, refetchStats]);

  useEffect(() => {
    if (showResultsPanel && auth.user) {
      refetchStats();
    }
  }, [showResultsPanel, auth.user, refetchStats]);

  const gameStatusText = game.gameStatus === 'PLAYING'
    ? `${game.attempts}/6 attempts`
    : game.gameStatus.toLowerCase();

  const handleModeSwitch = useCallback((newMode) => {
    setMode(newMode);
    setModalDismissed(false);
    setShowResultsPanel(false);
  }, []);

  const handlePracticeReplay = useCallback(() => {
    practice.startSession();
    setModalDismissed(false);
  }, [practice.startSession]);

  // ── Loading state ─────────────────────────────────────────────────────
  if (auth.isLoading || (mode === 'daily' && daily.isLoading)) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (mode === 'daily' && daily.error) {
    return (
      <div className="App">
        <Header
          mode={mode}
          onSwitchMode={handleModeSwitch}
          user={auth.user}
          onAuthClick={() => setShowAuthModal(true)}
          onLogout={auth.logout}
          onStatsClick={() => setShowStatsModal(true)}
          onLeaderboardClick={() => setShowLeaderboardModal(true)}
        />
        <div className="app-error">
          <p>{daily.error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Header
        mode={mode}
        onSwitchMode={handleModeSwitch}
        user={auth.user}
        onAuthClick={() => setShowAuthModal(true)}
        onLogout={auth.logout}
        onStatsClick={() => setShowStatsModal(true)}
        onLeaderboardClick={() => setShowLeaderboardModal(true)}
      />

      {/* Toast notifications (Task 8.10) */}
      <Toast message={game.toast?.message} type={game.toast?.type} />

      {/* Practice loading spinner */}
      {mode === 'practice' && practice.isLoading && !practice.practiceId && (
        <div className="app-loading">
          <div className="spinner" />
        </div>
      )}

      <main className="game-shell" aria-label="Wordle game">
        <section className="game-status-strip" aria-label="Current game status">
          <span>{mode === 'daily' ? 'Daily Challenge' : 'Practice Mode'}</span>
          <span>{gameStatusText}</span>
        </section>

        {/* Game board */}
        <GameBoard
          guessResults={game.guessResults}
          currentGuess={game.currentGuess}
          currentRow={game.submittedWords.length}
        />

        {/* Virtual keyboard */}
        {isGameOver && mode === 'daily' ? (
          <div className="see-results-section">
            <button
              className="see-results-btn"
              type="button"
              onClick={() => setShowResultsPanel(true)}
            >
              See results
            </button>
          </div>
        ) : (
          <Keyboard
            onKeyPress={game.handleKeyPress}
            keyboardStatus={game.keyboardStatus}
            disabled={isGameOver || (mode === 'practice' && practice.isLoading)}
          />
        )}
      </main>

      {/* Daily mode uses ResultsPanel instead of auto-popup modals */}
      {mode === 'daily' && isGameOver && showResultsPanel && (
        <Suspense fallback={null}>
          <ResultsPanel
            isOpen
            onClose={() => setShowResultsPanel(false)}
            gameStatus={game.gameStatus}
            attempts={game.attempts}
            user={auth.user}
            stats={stats}
            isStatsLoading={isStatsLoading}
            statsError={statsError}
            previousStats={completionStatsSnapshot}
            gameId={daily.gameId}
            guessResults={game.guessResults}
            submittedWords={daily.submittedWords}
            targetWord={daily.targetWord}
            gameDate={dailyGameDate}
            onToast={game.showToast}
          />
        </Suspense>
      )}

      {/* Practice mode keeps the existing WinModal/LoseModal flow */}
      {mode === 'practice' && isGameOver && isWon && !modalDismissed && (
        <Suspense fallback={null}>
          <WinModal
            isOpen
            onClose={() => setModalDismissed(true)}
            attempts={game.attempts}
            user={auth.user}
            stats={stats}
            isStatsLoading={isStatsLoading}
            statsError={statsError}
            guessResults={game.guessResults}
            mode={mode}
            gameDate={dailyGameDate}
            onToast={game.showToast}
            onPlayAgain={handlePracticeReplay}
          />
        </Suspense>
      )}

      {mode === 'practice' && isGameOver && !isWon && !modalDismissed && (
        <Suspense fallback={null}>
          <LoseModal
            isOpen
            onClose={() => setModalDismissed(true)}
            answer={practice.targetWord}
            attempts={game.attempts}
            guessResults={game.guessResults}
            mode={mode}
            gameDate={dailyGameDate}
            onToast={game.showToast}
            onPlayAgain={handlePracticeReplay}
          />
        </Suspense>
      )}

      {/* Stats and leaderboard modals (Phase 9) */}
      {showStatsModal && (
        <Suspense fallback={null}>
          <StatsModal
            isOpen
            onClose={() => setShowStatsModal(false)}
            user={auth.user}
            stats={stats}
            isLoading={isStatsLoading}
            error={statsError}
            refetch={refetchStats}
            highlightAttempt={mode === 'daily' && daily.gameStatus === 'WON' ? daily.attempts : null}
          />
        </Suspense>
      )}

      {showLeaderboardModal && (
        <Suspense fallback={null}>
          <LeaderboardModal
            isOpen
            onClose={() => setShowLeaderboardModal(false)}
            onToast={game.showToast}
          />
        </Suspense>
      )}

      {/* Auth modal (Task 8.2, 8.11) */}
      {showAuthModal && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen
            onClose={() => { setShowAuthModal(false); setMergeResult(null); }}
            isLoading={auth.isLoading}
            error={auth.error}
            mergeResult={mergeResult}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
