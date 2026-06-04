import { useEffect, useState } from 'react';
import { ArrowClockwise, Timer } from '@phosphor-icons/react';
import './CountdownTimer.css';

/**
 * CountdownTimer - time until the next 00:00 UTC daily word.
 *
 * @see WBS Task 9.6
 */

function getRemainingMs() {
  const now = new Date();
  const nextUtcMidnight = new Date(now);
  nextUtcMidnight.setUTCHours(24, 0, 0, 0);
  return Math.max(0, nextUtcMidnight.getTime() - now.getTime());
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

const CountdownTimer = ({ compact = false }) => {
  const [remainingMs, setRemainingMs] = useState(getRemainingMs);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs(getRemainingMs());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const isReady = remainingMs <= 0;

  return (
    <div className={`countdown-timer ${compact ? 'countdown-timer--compact' : ''}`}>
      <span className="countdown-label">
        <Timer size={17} weight="bold" aria-hidden="true" />
        <span>{isReady ? 'New word available!' : 'Next word'}</span>
      </span>
      {isReady ? (
        <button
          className="countdown-refresh"
          type="button"
          onClick={() => window.location.reload()}
        >
          <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
          <span>Refresh</span>
        </button>
      ) : (
        <span className="countdown-value">{formatRemaining(remainingMs)}</span>
      )}
    </div>
  );
};

export default CountdownTimer;
