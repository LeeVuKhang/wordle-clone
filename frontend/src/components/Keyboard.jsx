import Key from './Key';
import './Keyboard.css';

const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DELETE'],
];

const Keyboard = ({ onKeyPress, keyboardStatus, disabled }) => {
    const handleKeyClick = (key) => {
        if (!disabled) {
            onKeyPress(key);
        }
    };

    return (
        <div className="keyboard">
            {KEYBOARD_ROWS.map((row) => (
                <div className="keyboard-row" key={row.join('')}>
                    {row.map((key) => (
                    <Key
                        key={key}
                        value={key}
                        status={keyboardStatus[key]}
                        onClick={handleKeyClick}
                        isWide={key === 'ENTER' || key === 'DELETE'}
                        disabled={disabled}
                    />
                    ))}
                </div>
            ))}
        </div>
    );
};

export default Keyboard;
