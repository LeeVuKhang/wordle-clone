import { Question, X } from '@phosphor-icons/react';
import DialogFrame from './DialogFrame.jsx';
import './HowToPlayModal.css';

const HowToPlayModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <DialogFrame
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="howto-overlay"
      contentClassName="howto-modal"
      labelledBy="howto-heading"
    >
      <section
        aria-labelledby="howto-heading"
      >
        <header className="howto-header">
          <span className="howto-header-icon" aria-hidden="true">
            <Question size={24} weight="bold" />
          </span>
          <div>
            <h2 id="howto-heading">How to play</h2>
            <p>Guess the hidden 5-letter word in 6 tries.</p>
          </div>
          <button className="howto-close" type="button" onClick={onClose} aria-label="Close guide">
            <X size={17} weight="bold" aria-hidden="true" />
          </button>
        </header>

        <div className="howto-content">
          <section aria-labelledby="howto-basics-heading">
            <h3 id="howto-basics-heading">Basics</h3>
            <ul className="howto-list">
              <li>Type a 5-letter word, then press Enter.</li>
              <li>Use Backspace to remove letters before you submit.</li>
              <li>Daily has one puzzle per day. Practice lets you keep playing.</li>
            </ul>
          </section>

          <section aria-labelledby="howto-colors-heading">
            <h3 id="howto-colors-heading">Tile colors</h3>
            <div className="howto-example-row" aria-hidden="true">
              <span className="howto-tile howto-tile--correct">C</span>
              <span className="howto-tile howto-tile--present">R</span>
              <span className="howto-tile howto-tile--absent">A</span>
              <span className="howto-tile">N</span>
              <span className="howto-tile">E</span>
            </div>

            <ul className="howto-feedback-list">
              <li>
                <span className="howto-swatch howto-swatch--correct" aria-hidden="true">C</span>
                <span>Green means the letter is in the correct spot.</span>
              </li>
              <li>
                <span className="howto-swatch howto-swatch--present" aria-hidden="true">R</span>
                <span>Yellow means the letter is in the word, but elsewhere.</span>
              </li>
              <li>
                <span className="howto-swatch howto-swatch--absent" aria-hidden="true">A</span>
                <span>Gray means the letter is not in the word.</span>
              </li>
            </ul>
          </section>
        </div>

        <button className="howto-primary" type="button" onClick={onClose}>
          Got it
        </button>
      </section>
    </DialogFrame>
  );
};

export default HowToPlayModal;
