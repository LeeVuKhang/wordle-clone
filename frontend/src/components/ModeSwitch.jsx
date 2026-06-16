import './ModeSwitch.css';

/**
 * ModeSwitch — Toggle between Daily Challenge and Practice Mode
 *
 * WBS Task 8.8
 */
const ModeSwitch = ({ mode, onSwitch }) => {
  return (
    <div className="mode-switch" role="tablist" aria-label="Game mode">
      <button
        id="mode-daily"
        type="button"
        role="tab"
        aria-selected={mode === 'daily'}
        className={`mode-btn ${mode === 'daily' ? 'mode-btn--active' : ''}`}
        onClick={() => onSwitch('daily')}
      >
        Daily
      </button>
      <button
        id="mode-practice"
        type="button"
        role="tab"
        aria-selected={mode === 'practice'}
        className={`mode-btn ${mode === 'practice' ? 'mode-btn--active' : ''}`}
        onClick={() => onSwitch('practice')}
      >
        Practice
      </button>
    </div>
  );
};

export default ModeSwitch;
