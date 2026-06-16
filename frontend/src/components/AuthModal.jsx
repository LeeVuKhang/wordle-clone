import { CheckCircle, GoogleLogo } from '@phosphor-icons/react';
import DialogFrame from './DialogFrame.jsx';
import './AuthModal.css';

function handleGoogleLogin() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`;
  const scope = 'openid email profile';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'select_account',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * AuthModal: Google OAuth login and guest merge UX.
 */
const AuthModal = ({ isOpen, onClose, isLoading, error, mergeResult }) => {
  if (!isOpen) return null;

  return (
    <DialogFrame
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="auth-modal-overlay"
      contentClassName="auth-modal"
      labelledBy={mergeResult ? 'auth-merge-title' : 'auth-title'}
    >
        {mergeResult ? (
          <div className="auth-modal__merge-success">
            <div className="auth-modal__icon auth-modal__icon--success" aria-hidden="true">
              <CheckCircle size={30} weight="bold" />
            </div>
            <h2 id="auth-merge-title">Welcome back!</h2>
            <p className="auth-modal__merge-info">
              Your progress has been saved.
            </p>
            {mergeResult.merged.gamesTransferred > 0 && (
              <p className="auth-modal__merge-stats">
                {mergeResult.merged.gamesTransferred} game
                {mergeResult.merged.gamesTransferred !== 1 ? 's' : ''} transferred
              </p>
            )}
            <p className="auth-modal__streak">
              Current streak: <strong>{mergeResult.stats.currentStreak}</strong>
            </p>
            <button className="auth-modal__close-btn" type="button" onClick={onClose}>
              Continue playing
            </button>
          </div>
        ) : (
          <>
            <div className="auth-modal__icon" aria-hidden="true">
              <GoogleLogo size={30} weight="bold" />
            </div>
            <h2 className="auth-modal__title" id="auth-title">Sign in to save progress</h2>
            <p className="auth-modal__subtitle">
              Your streak and stats will be preserved across devices.
            </p>

            {error && (
              <div className="auth-modal__error" role="alert">
                {error}
              </div>
            )}

            <button
              id="google-login-btn"
              className="auth-modal__google-btn"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <GoogleLogo size={18} weight="bold" aria-hidden="true" />
              <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
            </button>

            <p className="auth-modal__guest-note">
              You can also keep playing as a guest; your progress stays in
              this browser until you sign in.
            </p>

            <button className="auth-modal__dismiss" type="button" onClick={onClose}>
              Continue as guest
            </button>
          </>
        )}
    </DialogFrame>
  );
};

export default AuthModal;
