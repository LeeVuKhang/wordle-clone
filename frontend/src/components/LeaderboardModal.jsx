import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, Trophy, X } from '@phosphor-icons/react';
import { statsApi } from '../services/api.js';
import './PanelModal.css';
import './LeaderboardModal.css';

function formatTimestamp(value) {
  if (!value) return 'Not loaded';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRefreshCountdown(nextRefresh) {
  if (!nextRefresh) return '00:00';

  const remaining = Math.max(0, new Date(nextRefresh).getTime() - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * LeaderboardModal - public top streak leaderboard.
 *
 * @see WBS Task 9.5
 */
const LeaderboardModal = ({ isOpen, onClose, onToast }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await statsApi.getLeaderboard();
      setData(res.data);
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Unable to load leaderboard';
      setError(message);
      onToast?.(message, 'warning');
    } finally {
      setIsLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen, loadLeaderboard]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isOpen]);

  const refreshCountdown = useMemo(
    () => getRefreshCountdown(data?.nextRefresh),
    [data?.nextRefresh, tick],
  );

  if (!isOpen) return null;

  return (
    <div className="panel-overlay leaderboard-overlay" onClick={onClose}>
      <div className="panel-modal leaderboard-modal" onClick={(event) => event.stopPropagation()}>
        <div className="leaderboard-header">
          <div className="leaderboard-heading-lockup">
            <span className="leaderboard-heading-icon" aria-hidden="true">
              <Trophy size={24} weight="bold" />
            </span>
            <div>
            <h2>Leaderboard</h2>
            <p>Top streaks</p>
            </div>
          </div>
          <button type="button" onClick={onClose}>
            <X size={16} weight="bold" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        {isLoading && (
          <div className="leaderboard-loading">
            <div className="leaderboard-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>Loading leaderboard...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="leaderboard-error">
            <p>{error}</p>
            <button type="button" onClick={loadLeaderboard}>
              <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <div className="leaderboard-meta">
              <span>Last updated {formatTimestamp(data.cachedAt)}</span>
              <span>Refresh in {refreshCountdown}</span>
            </div>

            {data.entries.length === 0 ? (
              <p className="leaderboard-empty">No streaks yet.</p>
            ) : (
              <div className="leaderboard-table" role="table" aria-label="Top streak leaderboard">
                <div className="leaderboard-row leaderboard-row--head" role="row">
                  <span role="columnheader">Rank</span>
                  <span role="columnheader">Username</span>
                  <span role="columnheader">Max</span>
                  <span role="columnheader">Current</span>
                  <span role="columnheader">Won</span>
                </div>
                {data.entries.map((entry) => (
                  <div className="leaderboard-row" role="row" key={`${entry.rank}-${entry.username}`}>
                    <span role="cell">{entry.rank}</span>
                    <span role="cell">{entry.username || 'Anonymous'}</span>
                    <span role="cell">{entry.maxStreak}</span>
                    <span role="cell">{entry.currentStreak}</span>
                    <span role="cell">{entry.gamesWon}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LeaderboardModal;
