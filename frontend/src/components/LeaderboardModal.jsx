import { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise, Trophy, X } from '@phosphor-icons/react';
import DialogFrame from './DialogFrame.jsx';
import { statsApi } from '../services/api.js';
import './PanelModal.css';
import './LeaderboardModal.css';

const leaderboardDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatTimestamp(value) {
  if (!value) return 'Not loaded';
  return leaderboardDateFormatter.format(new Date(value));
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

  const refreshCountdown = getRefreshCountdown(data?.nextRefresh, tick);

  if (!isOpen) return null;

  return (
    <DialogFrame
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="panel-overlay leaderboard-overlay"
      contentClassName="panel-modal leaderboard-modal"
      labelledBy="leaderboard-heading"
    >
        <div className="leaderboard-header">
          <div className="leaderboard-heading-lockup">
            <span className="leaderboard-heading-icon" aria-hidden="true">
              <Trophy size={24} weight="bold" />
            </span>
            <div>
            <h2 id="leaderboard-heading">Leaderboard</h2>
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
              <table className="leaderboard-table" aria-label="Top streak leaderboard">
                <thead>
                  <tr className="leaderboard-row leaderboard-row--head">
                    <th scope="col">Rank</th>
                    <th scope="col">Username</th>
                    <th scope="col">Max</th>
                    <th scope="col">Current</th>
                    <th scope="col">Won</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr className="leaderboard-row" key={`${entry.rank}-${entry.username}`}>
                      <td>{entry.rank}</td>
                      <td>{entry.username || 'Anonymous'}</td>
                      <td>{entry.maxStreak}</td>
                      <td>{entry.currentStreak}</td>
                      <td>{entry.gamesWon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
    </DialogFrame>
  );
};

export default LeaderboardModal;
