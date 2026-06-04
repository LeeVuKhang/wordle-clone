import ModeSwitch from './ModeSwitch';
import {
  ChartBar,
  SignIn,
  SignOut,
  Trophy,
  UserCircle,
} from '@phosphor-icons/react';
import './Header.css';

/**
 * Header — app title, mode switcher, auth button
 *
 * WBS Tasks 8.2, 8.8
 */
const Header = ({
  mode,
  onSwitchMode,
  user,
  onAuthClick,
  onLogout,
  onStatsClick,
  onLeaderboardClick,
}) => {
  const activeModeLabel = mode === 'daily' ? 'Daily' : 'Practice';
  const playerName = user ? (user.username || user.email.split('@')[0]) : null;

  return (
    <header className="header">
      <div className="header-container">
        <a className="brand-link" href="/" aria-label="Wordle Clone home">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span className="brand-copy">
            <span className="title">Wordle</span>
            <span className="title-subtitle">Clone</span>
          </span>
        </a>

        <div className="header-play">
          <span className="header-pill" aria-label={`Current mode ${activeModeLabel}`}>
            {activeModeLabel}
          </span>
          <ModeSwitch mode={mode} onSwitch={onSwitchMode} />
        </div>

        <div className="header-nav" aria-label="Player panels">
          <button className="header-btn header-btn--tool" type="button" onClick={onStatsClick} aria-label="Stats">
            <ChartBar size={17} weight="bold" aria-hidden="true" />
            <span>Stats</span>
          </button>
          <button className="header-btn header-btn--tool" type="button" onClick={onLeaderboardClick} aria-label="Leaderboard">
            <Trophy size={17} weight="bold" aria-hidden="true" />
            <span>Leaderboard</span>
          </button>
        </div>

        <div className="header-auth">
          {user ? (
            <div className="header-user">
              <span className="header-username" title={playerName}>
                <UserCircle size={18} weight="bold" aria-hidden="true" />
                <span>{playerName}</span>
              </span>
              <button className="header-btn header-btn--ghost" onClick={onLogout} aria-label="Sign out">
                <SignOut size={17} weight="bold" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <button
              id="header-login-btn"
              className="header-btn header-btn--primary"
              onClick={onAuthClick}
              aria-label="Sign in"
            >
              <SignIn size={17} weight="bold" aria-hidden="true" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
