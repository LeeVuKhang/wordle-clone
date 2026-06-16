import Cell from './Cell';
import { TILE_REVEAL_STAGGER_MS } from '../utils/revealTiming.js';
import './Row.css';

const CELL_KEYS = ['cell-1', 'cell-2', 'cell-3', 'cell-4', 'cell-5'];

const Row = ({ result, currentGuess, isCurrentRow }) => {
  if (result && result.length > 0) {
    return (
      <div className="row">
        {CELL_KEYS.map((cellKey, i) => (
          <Cell
            key={cellKey}
            value={result[i]?.letter || ''}
            status={result[i]?.status || ''}
            revealDelay={(i * TILE_REVEAL_STAGGER_MS) / 1000}
          />
        ))}
      </div>
    );
  }

  if (isCurrentRow && currentGuess) {
    return (
      <div className="row">
        {CELL_KEYS.map((cellKey, i) => (
          <Cell
            key={cellKey}
            value={currentGuess[i] || ''}
            status={currentGuess[i] ? 'filled' : ''}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="row">
      {CELL_KEYS.map((cellKey) => (
        <Cell key={cellKey} value="" status="" />
      ))}
    </div>
  );
};

export default Row;
