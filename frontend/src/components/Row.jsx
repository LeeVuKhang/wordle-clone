import Cell from './Cell';
import { TILE_REVEAL_STAGGER_MS } from '../utils/revealTiming.js';
import './Row.css';

/**
 * Row — renders 5 cells for one guess attempt
 *
 * result   — { letter, status }[] from compareWord() (completed row)
 * currentGuess — string being typed (active row)
 */
const Row = ({ result, currentGuess, isCurrentRow }) => {
  const cells = [];

  if (result && result.length > 0) {
    // Completed row — show color-coded result with staggered reveal
    for (let i = 0; i < 5; i++) {
      cells.push(
        <Cell
          key={i}
          value={result[i]?.letter || ''}
          status={result[i]?.status || ''}
          revealDelay={(i * TILE_REVEAL_STAGGER_MS) / 1000}
        />
      );
    }
  } else if (isCurrentRow && currentGuess) {
    // Active typing row
    for (let i = 0; i < 5; i++) {
      cells.push(
        <Cell
          key={i}
          value={currentGuess[i] || ''}
          status={currentGuess[i] ? 'filled' : ''}
        />
      );
    }
  } else {
    // Empty row
    for (let i = 0; i < 5; i++) {
      cells.push(<Cell key={i} value="" status="" />);
    }
  }

  return <div className="row">{cells}</div>;
};

export default Row;
