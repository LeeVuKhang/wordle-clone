import './Key.css';

/**
 * Key — single keyboard button
 * status: 'correct' | 'present' | 'absent' | undefined
 */
const Key = ({ value, status, onClick, isWide = false, disabled = false }) => {
  const label = value === 'DELETE' ? 'DEL' : value;
  const ariaLabel = value === 'DELETE' ? 'Delete letter' : value;

  return (
    <button
      className={`key ${isWide ? 'wide' : ''} ${status || ''}`}
      type="button"
      onClick={() => onClick(value)}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

export default Key;
