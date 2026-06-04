import { ArrowLeft, Trophy, X } from '@phosphor-icons/react';
import CountdownTimer from './CountdownTimer';
import ShareButton from './ShareButton';
import './ResultsPanel.css';

function formatWinPercentage(value) {
  const rounded = Number(value || 0).toFixed(1);
  return rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
}

/**
 * ResultsPanel - daily post-game results screen.
 *
 * @see WBS Task 14A.2
 */
const ResultsPanel = ({
  isOpen,
  onClose,
  gameStatus,
  attempts,
  user,
  stats,
  isStatsLoading,
  statsError,
  guessResults,
  gameDate,
  onToast,
}) => {
  if (!isOpen) return null;

  const distribution = stats?.guessDistribution || {};
  const maxDistribution = Math.max(1, ...Object.values(distribution));
  const isAuthStatsError =
    typeof statsError === 'string' &&
    /auth|unauthorized|refresh token/i.test(statsError);
  const statsErrorMessage = statsError && !isAuthStatsError ? 'Could not load stats' : null;

  return (
    <div className="results-panel-overlay" onClick={onClose}>
      <section
        className="results-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="results-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="results-panel-close" type="button" onClick={onClose}>
          <ArrowLeft size={16} weight="bold" aria-hidden="true" />
          <span>Back to puzzle</span>
          <X size={15} weight="bold" aria-hidden="true" />
        </button>

        <div className="results-star-badge" aria-hidden="true">
          <Trophy size={31} weight="bold" />
        </div>

        <h2 className="results-heading" id="results-heading">
          Thanks for playing today!
        </h2>

        <section className="results-stats-section" aria-labelledby="results-statistics-label">
          <h3 className="results-stats-label" id="results-statistics-label">
            Statistics
          </h3>

          {user && !isStatsLoading && stats && (
            <div className="results-stats-grid">
              <div>
                <strong>{stats.gamesPlayed}</strong>
                <span>Played</span>
              </div>
              <div>
                <strong>{formatWinPercentage(stats.winPercentage)}</strong>
                <span>Win %</span>
              </div>
              <div>
                <strong>{stats.currentStreak}</strong>
                <span>Current Streak</span>
              </div>
              <div>
                <strong>{stats.maxStreak}</strong>
                <span>Max Streak</span>
              </div>
            </div>
          )}

          {user && isStatsLoading && (
            <p className="results-stats-message" aria-live="polite">
              Refreshing stats...
            </p>
          )}

          {user && !isStatsLoading && statsErrorMessage && (
            <p className="results-stats-message" aria-live="polite">
              {statsErrorMessage}
            </p>
          )}

          {!user && (
            <p className="results-stats-message">
              Login to see your stats
            </p>
          )}
        </section>

        <section className="results-distribution" aria-labelledby="results-distribution-label">
          <h3 className="results-distribution-label" id="results-distribution-label">
            Guess Distribution
          </h3>

          {[1, 2, 3, 4, 5, 6].map((attempt) => {
            const count = distribution[String(attempt)] || 0;
            const width = count === 0 ? '0%' : `${Math.max(8, (count / maxDistribution) * 100)}%`;
            const isHighlight = gameStatus === 'WON' && Number(attempts) === attempt;

            return (
              <div
                key={attempt}
                className={`results-bar-row ${isHighlight ? 'results-bar-row--highlight' : ''}`}
              >
                <span className="results-bar-label">{attempt}</span>
                <div className="results-bar-track">
                  <div className="results-bar-fill" style={{ width }}>
                    {count}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <div className="results-share-section">
          <ShareButton
            guessResults={guessResults}
            attempts={attempts}
            gameStatus={gameStatus}
            mode="daily"
            gameDate={gameDate}
            onToast={onToast}
          />
        </div>

        <div className="results-countdown-section">
          <CountdownTimer />
        </div>
      </section>
    </div>
  );
};

export default ResultsPanel;
