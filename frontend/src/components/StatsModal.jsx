import { useEffect, useMemo, useState } from 'react';
import {
  ArrowClockwise,
  ChartBar,
  Medal,
  X,
} from '@phosphor-icons/react';
import Badge from './Badge';
import WordleBotPanel from './WordleBotPanel.jsx';
import { computeBadges } from '../utils/badges.js';
import { selectLatestCompletedDailyGame } from '../utils/wordleBot.js';
import './PanelModal.css';
import './StatsModal.css';

function formatWinPercentage(value) {
  const rounded = Number(value || 0).toFixed(1);
  return rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
}

/**
 * StatsModal - authenticated player statistics dashboard.
 *
 * @see WBS Task 9.4
 */
const StatsModal = ({
  isOpen,
  onClose,
  user,
  stats,
  isLoading,
  error,
  refetch,
  highlightAttempt,
}) => {
  const [selectedBadgeId, setSelectedBadgeId] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      refetch?.();
    }
  }, [isOpen, user, refetch]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedBadgeId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedBadgeId(null);
  }, [stats]);

  const badges = useMemo(() => computeBadges(stats), [stats]);
  const wordleBotGame = useMemo(() => selectLatestCompletedDailyGame(stats), [stats]);
  const selectedBadge = badges.find((badge) => badge.id === selectedBadgeId);

  if (!isOpen) return null;

  const distribution = stats?.guessDistribution || {};
  const maxDistribution = Math.max(1, ...Object.values(distribution));
  const isAuthError =
    typeof error === 'string' &&
    /auth|unauthorized|refresh token/i.test(error);
  const displayError = error && !isAuthError ? error : null;

  return (
    <div className="panel-overlay stats-overlay" onClick={onClose}>
      <div className="panel-modal stats-modal" onClick={(event) => event.stopPropagation()}>
        <div className="stats-header">
          <div className="stats-heading-lockup">
            <span className="stats-heading-icon" aria-hidden="true">
              <ChartBar size={24} weight="bold" />
            </span>
            <h2>Statistics</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={16} weight="bold" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        {!user && (
          <p className="stats-empty">Login to track your statistics</p>
        )}

        {user && isLoading && (
          <div className="stats-loading">
            <div className="stats-skeleton-grid" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>Loading statistics...</p>
          </div>
        )}

        {user && !isLoading && displayError && (
          <div className="stats-error">
            <p>{displayError}</p>
            <button type="button" onClick={refetch}>
              <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {user && !isLoading && stats && (
          <div className="stats-content-scrollable">
            <div className="stats-summary-grid">
              <div>
                <span>Played</span>
                <strong>{stats.gamesPlayed}</strong>
              </div>
              <div>
                <span>Win %</span>
                <strong>{formatWinPercentage(stats.winPercentage)}</strong>
              </div>
              <div>
                <span>Current</span>
                <strong>{stats.currentStreak}</strong>
              </div>
              <div>
                <span>Max</span>
                <strong>{stats.maxStreak}</strong>
              </div>
            </div>

            <section className="stats-badges-section" aria-labelledby="stats-badges-heading">
              <div className="stats-section-title">
                <h3 id="stats-badges-heading"><Medal size={17} weight="bold" aria-hidden="true" /><span>Badges</span></h3>
                <p>Tap on any badge to view it in detail</p>
              </div>

              <div className="badges-container">
                {badges.map((badge) => (
                  <Badge
                    key={badge.id}
                    {...badge}
                    isSelected={selectedBadgeId === badge.id}
                    onSelect={(badgeId) => {
                      setSelectedBadgeId((currentId) => (
                        currentId === badgeId ? null : badgeId
                      ));
                    }}
                  />
                ))}
              </div>

              {selectedBadge && (
                <div className="stats-badge-detail" aria-live="polite">
                  <strong>{selectedBadge.name}</strong>
                  <p>{selectedBadge.description}</p>
                  <span>
                    {selectedBadge.isEarned ? 'Earned' : selectedBadge.progressText}
                  </span>
                </div>
              )}
            </section>

            <section className="stats-distribution" aria-labelledby="stats-distribution-heading">
              <h3 id="stats-distribution-heading">Guess Distribution</h3>
              {[1, 2, 3, 4, 5, 6].map((attempt) => {
                const count = distribution[String(attempt)] || 0;
                const width = count === 0 ? '0%' : `${Math.max(8, (count / maxDistribution) * 100)}%`;
                const isHighlight = Number(highlightAttempt) === attempt;

                return (
                  <div
                    key={attempt}
                    className={`stats-bar-row ${isHighlight ? 'stats-bar-row--highlight' : ''}`}
                  >
                    <span className="stats-bar-label">{attempt}</span>
                    <div className="stats-bar-track">
                      <div className="stats-bar-fill" style={{ width }}>
                        {count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <WordleBotPanel
              game={wordleBotGame}
              variant="stats"
              unavailableMessage="Complete a daily game to unlock Wordle Bot analysis."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsModal;
