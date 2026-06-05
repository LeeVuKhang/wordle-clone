import { useEffect, useId, useMemo, useState } from 'react';
import { ChartBar } from '@phosphor-icons/react';
import { useWordleBotAnalysis } from '../hooks/useWordleBotAnalysis.js';
import './WordleBotPanel.css';

function formatScore(value) {
  return Number.isFinite(value) ? String(Math.round(value)) : '--';
}

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatRank(row) {
  if (!row?.rank || !row?.rankTotal) return 'Not ranked';
  return `#${row.rank.toLocaleString()} of ${row.rankTotal.toLocaleString()}`;
}

function formatGameDate(game) {
  const value = game?.gameDate || game?.completedAt;
  if (!value) return 'latest daily';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'latest daily';

  return date.toISOString().slice(0, 10);
}

function gameIdentity(game) {
  if (!game) return null;

  return [
    game.id || game.gameId || '',
    game.gameDate || '',
    game.completedAt || '',
    game.status || game.gameStatus || '',
    game.targetWord || game.word || game.answer || '',
    Array.isArray(game.guesses) ? game.guesses.join(',') : '',
    Array.isArray(game.submittedWords) ? game.submittedWords.join(',') : '',
  ].join('|');
}

function attemptLabel(status, attempts) {
  if (status === 'WON') return `${attempts}/6`;
  return 'Missed';
}

function ScoreMeter({ label, value }) {
  const score = Number.isFinite(value) ? Math.max(0, Math.min(99, value)) : 0;

  return (
    <div className="wordlebot-meter">
      <div>
        <span>{label}</span>
        <strong>{formatScore(value)}</strong>
      </div>
      <div className="wordlebot-meter-track" aria-hidden="true">
        <span style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function PlayerRow({ row }) {
  return (
    <div className="wordlebot-row">
      <div className="wordlebot-row-heading">
        <div>
          <span>Guess {row.attempt}</span>
          <strong>{row.guess}</strong>
        </div>
        <span>{formatRank(row)}</span>
      </div>

      <div className="wordlebot-meters">
        <ScoreMeter label="Skill" value={row.skillScore} />
        <ScoreMeter label="Luck" value={row.luckScore} />
      </div>

      <dl className="wordlebot-details">
        <div>
          <dt>Remaining</dt>
          <dd>{formatNumber(row.remainingBefore)} to {formatNumber(row.remainingAfter)}</dd>
        </div>
        <div>
          <dt>Expected</dt>
          <dd>{formatNumber(row.expectedRemaining, 1)}</dd>
        </div>
        <div>
          <dt>Bot pick</dt>
          <dd>{row.botGuess || '--'}</dd>
        </div>
      </dl>
    </div>
  );
}

function BotRow({ row }) {
  return (
    <div className="wordlebot-row wordlebot-row--bot">
      <div className="wordlebot-row-heading">
        <div>
          <span>Bot {row.attempt}</span>
          <strong>{row.guess}</strong>
        </div>
        <span>{row.isAnswer ? 'Solved' : `${formatNumber(row.remainingAfter)} left`}</span>
      </div>

      <dl className="wordlebot-details wordlebot-details--bot">
        <div>
          <dt>Remaining</dt>
          <dd>{formatNumber(row.remainingBefore)} to {formatNumber(row.remainingAfter)}</dd>
        </div>
        <div>
          <dt>Entropy</dt>
          <dd>{formatNumber(row.weightedEntropy, 2)}</dd>
        </div>
        <div>
          <dt>Expected</dt>
          <dd>{formatNumber(row.expectedRemaining, 1)}</dd>
        </div>
      </dl>
    </div>
  );
}

const WordleBotPanel = ({
  game,
  description,
  unavailableMessage = 'Complete a daily game to unlock Wordle Bot analysis.',
  className = '',
  variant = 'default',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const headingId = useId();
  const {
    status,
    progressStage,
    analysis,
    error,
    analyze,
    reset,
  } = useWordleBotAnalysis();
  const identity = useMemo(() => gameIdentity(game), [game]);
  const hasGame = Boolean(game);
  const isLoading = status === 'loading';
  const isReady = status === 'ready' && analysis;
  const isError = status === 'error';
  const shouldShowBody = isExpanded || isLoading;
  const panelDescription = hasGame
    ? description || `Analyze your ${formatGameDate(game)} guesses against the full word list.`
    : unavailableMessage;

  useEffect(() => {
    setIsExpanded(false);
    reset();
  }, [identity, reset]);

  const handleToggle = () => {
    if (!hasGame || isLoading) return;

    if (isExpanded && isReady) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);
    if (!isReady) {
      void analyze(game);
    }
  };

  const buttonLabel = isLoading
    ? 'Analyzing...'
    : isExpanded && isReady
      ? 'Hide Wordle Bot'
      : isError
        ? 'Retry Wordle Bot'
        : 'Check Wordle Bot';

  return (
    <section
      className={`wordlebot-panel wordlebot-panel--${variant} ${!hasGame ? 'wordlebot-panel--unavailable' : ''} ${className}`}
      aria-labelledby={headingId}
    >
      <div className="wordlebot-mark" aria-hidden="true">WB</div>
      <div className="wordlebot-copy">
        <h3 id={headingId}>Wordle Bot</h3>
        <p>{panelDescription}</p>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={!hasGame || isLoading}
      >
        <ChartBar size={16} weight="bold" aria-hidden="true" />
        <span>{buttonLabel}</span>
      </button>

      {shouldShowBody && (
        <div className="wordlebot-body" aria-live="polite">
          {isLoading && (
            <p className="wordlebot-loading" role="status">
              {progressStage || 'Analyzing the latest completed daily game...'}
            </p>
          )}

          {isError && (
            <p className="wordlebot-error">{error || 'Unable to analyze this daily game.'}</p>
          )}

          {isReady && (
            <>
              <div className={`wordlebot-verdict wordlebot-verdict--${analysis.verdict.toLowerCase()}`}>
                <span>{analysis.verdictText}</span>
                <strong>
                  You {attemptLabel(analysis.status, analysis.guessCount)} / Bot {attemptLabel(analysis.botStatus, analysis.botAttempts)}
                </strong>
              </div>

              <div className="wordlebot-summary-grid">
                <div>
                  <span>Avg Skill</span>
                  <strong>{formatScore(analysis.averageSkill)}</strong>
                </div>
                <div>
                  <span>Avg Luck</span>
                  <strong>{formatScore(analysis.averageLuck)}</strong>
                </div>
                <div>
                  <span>Final Pool</span>
                  <strong>{formatNumber(analysis.finalRemaining)}</strong>
                </div>
                <div>
                  <span>Words Ranked</span>
                  <strong>{formatNumber(analysis.rankingWordCount)}</strong>
                </div>
              </div>

              <div className="wordlebot-rounds" aria-label="Wordle Bot guess analysis">
                <h4>Your guesses</h4>
                {analysis.rows.map((row) => (
                  <PlayerRow row={row} key={`player-${row.attempt}-${row.guess}`} />
                ))}

                <h4>Bot path</h4>
                {analysis.botPath.map((row) => (
                  <BotRow row={row} key={`bot-${row.attempt}-${row.guess}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default WordleBotPanel;
