import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowClockwise,
  ChartBar,
  Medal,
  X,
} from '@phosphor-icons/react';
import Badge from './Badge';
import { computeBadges } from '../utils/badges.js';
import {
  analyzeCompletedDailyGame,
  selectLatestCompletedDailyGame,
} from '../utils/wordleBot.js';
import './PanelModal.css';
import './StatsModal.css';

const EMPTY_WORDLEBOT_STATE = {
  status: 'idle',
  isExpanded: false,
  gameKey: null,
  analysis: null,
  error: null,
};

function formatWinPercentage(value) {
  const rounded = Number(value || 0).toFixed(1);
  return rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
}

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

function wordleBotGameKey(game) {
  if (!game) return null;

  return [
    game.id || game.gameId || '',
    game.gameDate || '',
    game.completedAt || '',
    game.targetWord || game.word || game.answer || '',
    Array.isArray(game.guesses) ? game.guesses.join(',') : '',
  ].join('|');
}

function ScoreMeter({ label, value }) {
  const score = Number.isFinite(value) ? Math.max(0, Math.min(99, value)) : 0;

  return (
    <div className="stats-wordlebot-meter">
      <div>
        <span>{label}</span>
        <strong>{formatScore(value)}</strong>
      </div>
      <div className="stats-wordlebot-meter-track" aria-hidden="true">
        <span style={{ width: `${score}%` }} />
      </div>
    </div>
  );
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
  const [wordleBotState, setWordleBotState] = useState(EMPTY_WORDLEBOT_STATE);
  const wordleBotTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen && user) {
      refetch?.();
    }
  }, [isOpen, user, refetch]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedBadgeId(null);
      window.clearTimeout(wordleBotTimerRef.current);
      wordleBotTimerRef.current = null;
      setWordleBotState(EMPTY_WORDLEBOT_STATE);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedBadgeId(null);
    window.clearTimeout(wordleBotTimerRef.current);
    wordleBotTimerRef.current = null;
    setWordleBotState(EMPTY_WORDLEBOT_STATE);
  }, [stats]);

  useEffect(() => () => {
    window.clearTimeout(wordleBotTimerRef.current);
  }, []);

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
  const canAnalyzeWordleBot = Boolean(wordleBotGame);
  const wordleBotGameLabel = formatGameDate(wordleBotGame);

  const handleWordleBotClick = () => {
    if (!wordleBotGame) return;

    const gameKey = wordleBotGameKey(wordleBotGame);

    if (wordleBotState.analysis && wordleBotState.gameKey === gameKey) {
      setWordleBotState((current) => ({
        ...current,
        isExpanded: !current.isExpanded,
      }));
      return;
    }

    window.clearTimeout(wordleBotTimerRef.current);
    setWordleBotState({
      ...EMPTY_WORDLEBOT_STATE,
      status: 'loading',
      isExpanded: true,
      gameKey,
    });

    wordleBotTimerRef.current = window.setTimeout(() => {
      try {
        const analysis = analyzeCompletedDailyGame(wordleBotGame);

        setWordleBotState({
          status: analysis ? 'ready' : 'error',
          isExpanded: true,
          gameKey,
          analysis,
          error: analysis ? null : 'No completed daily game is ready for analysis.',
        });
      } catch (err) {
        setWordleBotState({
          status: 'error',
          isExpanded: true,
          gameKey,
          analysis: null,
          error: err?.message || 'Unable to analyze this daily game.',
        });
      } finally {
        wordleBotTimerRef.current = null;
      }
    }, 0);
  };

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

            <section
              className={`stats-wordlebot-banner ${!canAnalyzeWordleBot ? 'stats-wordlebot-banner--unavailable' : ''}`}
              aria-labelledby="stats-wordlebot-heading"
            >
              <div className="stats-wordlebot-mark" aria-hidden="true">WB</div>
              <div>
                <h3 id="stats-wordlebot-heading">Wordle Bot</h3>
                <p>
                  {canAnalyzeWordleBot
                    ? `Analyze your ${wordleBotGameLabel} guesses against the full word list.`
                    : 'Complete a daily game to unlock Wordle Bot analysis.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleWordleBotClick}
                disabled={!canAnalyzeWordleBot || wordleBotState.status === 'loading'}
              >
                <ChartBar size={16} weight="bold" aria-hidden="true" />
                <span>
                  {wordleBotState.status === 'loading'
                    ? 'Analyzing...'
                    : wordleBotState.isExpanded
                      ? 'Hide Wordle Bot'
                      : 'Check Wordle Bot'}
                </span>
              </button>

              {wordleBotState.isExpanded && (
                <div className="stats-wordlebot-panel" aria-live="polite">
                  {wordleBotState.status === 'loading' && (
                    <p className="stats-wordlebot-loading" role="status">
                      Analyzing the latest completed daily game...
                    </p>
                  )}

                  {wordleBotState.status === 'error' && (
                    <p className="stats-wordlebot-error">{wordleBotState.error}</p>
                  )}

                  {wordleBotState.status === 'ready' && wordleBotState.analysis && (
                    <>
                      <div className="stats-wordlebot-summary-grid">
                        <div>
                          <span>Avg Skill</span>
                          <strong>{formatScore(wordleBotState.analysis.averageSkill)}</strong>
                        </div>
                        <div>
                          <span>Avg Luck</span>
                          <strong>{formatScore(wordleBotState.analysis.averageLuck)}</strong>
                        </div>
                        <div>
                          <span>Guesses</span>
                          <strong>{wordleBotState.analysis.guessCount}</strong>
                        </div>
                        <div>
                          <span>Final Pool</span>
                          <strong>{formatNumber(wordleBotState.analysis.finalRemaining)}</strong>
                        </div>
                      </div>

                      <div className="stats-wordlebot-rounds" aria-label="Wordle Bot guess analysis">
                        {wordleBotState.analysis.rows.map((row) => (
                          <div className="stats-wordlebot-row" key={`${row.attempt}-${row.guess}`}>
                            <div className="stats-wordlebot-row-heading">
                              <div>
                                <span>Guess {row.attempt}</span>
                                <strong>{row.guess}</strong>
                              </div>
                              <span>{formatRank(row)}</span>
                            </div>

                            <div className="stats-wordlebot-meters">
                              <ScoreMeter label="Skill" value={row.skillScore} />
                              <ScoreMeter label="Luck" value={row.luckScore} />
                            </div>

                            <dl className="stats-wordlebot-details">
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
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsModal;
