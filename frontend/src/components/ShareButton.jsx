import { useEffect, useRef, useState } from 'react';
import { ShareNetwork } from '@phosphor-icons/react';
import { generateShareText } from '../utils/shareResult.js';
import './ShareButton.css';

/**
 * ShareButton - copies the emoji grid result to clipboard.
 *
 * @see WBS Task 9.3
 */
const ShareButton = ({
  guessResults,
  attempts,
  gameStatus,
  mode,
  gameDate,
  onToast,
}) => {
  const [fallbackText, setFallbackText] = useState('');
  const textareaRef = useRef(null);

  const shareText = generateShareText(guessResults, attempts, gameStatus, mode, gameDate);

  useEffect(() => {
    if (fallbackText && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [fallbackText]);

  const handleShare = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }

      await navigator.clipboard.writeText(shareText);
      setFallbackText('');
      onToast?.('Copied!', 'success');
    } catch {
      setFallbackText(shareText);
      onToast?.('Copy not available; select the text below', 'warning');
    }
  };

  return (
    <div className="share-block">
      <button className="share-btn" type="button" onClick={handleShare}>
        <ShareNetwork size={18} weight="bold" aria-hidden="true" />
        <span>Share</span>
      </button>

      {fallbackText && (
        <textarea
          ref={textareaRef}
          className="share-fallback"
          value={fallbackText}
          readOnly
          aria-label="Share text"
        />
      )}
    </div>
  );
};

export default ShareButton;
