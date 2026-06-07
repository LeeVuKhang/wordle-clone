import { useEffect, useState } from 'react';
import { Trophy } from '@phosphor-icons/react';
import CountdownTimer from './CountdownTimer';
import ShareButton from './ShareButton';
import WordleBotPanel from './WordleBotPanel.jsx';
import './ResultModal.css';
import './WinModal.css';

const CONFETTI_COLORS = [
  'var(--color-correct-strong)',
  'var(--color-present-strong)',
  'var(--color-text-secondary)',
];

function createConfetti() {
  return Array.from({ length: 34 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 34;
    const radius = 112 + Math.random() * 90;
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 60;
    const y = Math.sin(angle) * radius - 54 + (Math.random() - 0.5) * 48;

    return {
      id: index,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      x: `${x.toFixed(0)}px`,
      y: `${y.toFixed(0)}px`,
      rotation: `${Math.floor(Math.random() * 720 - 360)}deg`,
      delay: `${(Math.random() * 0.18).toFixed(2)}s`,
      duration: `${(1.35 + Math.random() * 0.48).toFixed(2)}s`,
    };
  });
}

/**
 * WinModal - daily/practice victory modal with CSS confetti.
 *
 * @see WBS Tasks 9.1, 9.3, 9.6
 */
const WinModal = ({
  isOpen,
  onClose,
  attempts,
  user,
  stats,
  isStatsLoading,
  statsError,
  guessResults,
  mode,
  gameDate,
  onToast,
  onPlayAgain,
  wordleBotGame,
}) => {
  const [confetti, setConfetti] = useState([]);
  const isDaily = mode === 'daily';
  const isAuthStatsError =
    typeof statsError === 'string' &&
    /auth|unauthorized|refresh token/i.test(statsError);
  const statsErrorMessage = statsError && !isAuthStatsError ? 'Could not load stats' : null;

  useEffect(() => {
    if (!isOpen) return undefined;

    setConfetti(createConfetti());
    const timer = window.setTimeout(() => setConfetti([]), 3000);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="result-overlay" onClick={onClose}>
      <div className="result-modal win-modal" onClick={(event) => event.stopPropagation()}>
        <div className="win-confetti" aria-hidden="true">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="win-confetti-piece"
              style={{
                '--confetti-color': piece.color,
                '--confetti-x': piece.x,
                '--confetti-y': piece.y,
                '--confetti-rotation': piece.rotation,
                '--confetti-delay': piece.delay,
                '--confetti-duration': piece.duration,
              }}
            />
          ))}
        </div>

        <div className="result-icon result-icon--win" aria-hidden="true">
          <Trophy size={30} weight="bold" />
        </div>

        <h2 className="result-title">You won!</h2>
        <p className="result-message">
          You got it in {attempts} {attempts === 1 ? 'try' : 'tries'}!
        </p>

        {isDaily && (
          <div className="win-stats-panel">
            {user ? (
              <>
                {isStatsLoading && <p className="result-note">Refreshing stats...</p>}
                {!isStatsLoading && stats && (
                  <div className="win-stats-grid">
                    <div>
                      <span>Current streak</span>
                      <strong>{stats.currentStreak}</strong>
                    </div>
                    <div>
                      <span>Max streak</span>
                      <strong>{stats.maxStreak}</strong>
                    </div>
                  </div>
                )}
                {!isStatsLoading && statsErrorMessage && (
                  <p className="result-note">{statsErrorMessage}</p>
                )}
              </>
            ) : (
              <p className="result-note">Login to see your stats</p>
            )}
          </div>
        )}

        <ShareButton
          guessResults={guessResults}
          attempts={attempts}
          gameStatus="WON"
          mode={mode}
          gameDate={gameDate}
          onToast={onToast}
        />

        {isDaily && <CountdownTimer />}

        {mode === 'practice' && (
          <WordleBotPanel
            game={wordleBotGame}
            variant="practice"
            description="Analyze this practice run against the full word list."
            unavailableMessage="Finish this practice puzzle to unlock Wordle Bot analysis."
          />
        )}

        <div className="result-actions">
          {mode === 'practice' && (
            <button className="result-btn result-btn--primary" type="button" onClick={onPlayAgain}>
              Play Again
            </button>
          )}
          <button className="result-btn result-btn--secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WinModal;
