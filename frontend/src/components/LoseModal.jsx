import { WarningCircle } from '@phosphor-icons/react';
import CountdownTimer from './CountdownTimer';
import DialogFrame from './DialogFrame.jsx';
import ShareButton from './ShareButton';
import WordleBotPanel from './WordleBotPanel.jsx';
import './ResultModal.css';
import './LoseModal.css';

/**
 * LoseModal - answer reveal and sharing for completed games.
 *
 * @see WBS Tasks 9.2, 9.3, 9.6
 */
const LoseModal = ({
  isOpen,
  onClose,
  answer,
  attempts,
  guessResults,
  mode,
  gameDate,
  onToast,
  onPlayAgain,
  wordleBotGame,
}) => {
  if (!isOpen) return null;

  const isDaily = mode === 'daily';

  return (
    <DialogFrame
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="result-overlay"
      contentClassName="result-modal lose-modal"
      labelledBy="lose-title"
    >
        <div className="result-icon result-icon--lose" aria-hidden="true">
          <WarningCircle size={30} weight="bold" />
        </div>

        <h2 className="result-title" id="lose-title">Game Over</h2>
        <p className="lose-kicker">The word was</p>
        <div className="lose-answer" aria-label={`Correct answer ${answer}`}>
          {answer}
        </div>

        <ShareButton
          guessResults={guessResults}
          attempts={attempts}
          gameStatus="LOST"
          mode={mode}
          gameDate={gameDate}
          onToast={onToast}
        />

        {isDaily && <CountdownTimer />}

        {mode === 'practice' && (
          <WordleBotPanel
            game={wordleBotGame}
            variant="practice"
            description="Analyze this practice run against the full word list."
            unavailableMessage="Finish this practice puzzle to unlock Wordle Bot analysis."
          />
        )}

        <div className="result-actions">
          {mode === 'practice' && (
            <button className="result-btn result-btn--primary" type="button" onClick={onPlayAgain}>
              Play Again
            </button>
          )}
          <button className="result-btn result-btn--secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
    </DialogFrame>
  );
};

export default LoseModal;
