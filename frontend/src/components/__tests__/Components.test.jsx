import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Cell from '../Cell.jsx';
import GameBoard from '../GameBoard.jsx';
import Keyboard from '../Keyboard.jsx';
import Modal from '../Modal.jsx';
import ModeSwitch from '../ModeSwitch.jsx';
import ResultsPanel from '../ResultsPanel.jsx';
import StatsModal from '../StatsModal.jsx';

const wordleBotMock = vi.hoisted(() => ({
  selectLatestCompletedDailyGame: vi.fn(),
  analyzeCompletedDailyGame: vi.fn(),
}));

vi.mock('../../utils/wordleBot.js', () => ({
  selectLatestCompletedDailyGame: wordleBotMock.selectLatestCompletedDailyGame,
  analyzeCompletedDailyGame: wordleBotMock.analyzeCompletedDailyGame,
}));

const completedRow = [
  { letter: 'C', status: 'correct' },
  { letter: 'R', status: 'present' },
  { letter: 'A', status: 'absent' },
  { letter: 'N', status: 'absent' },
  { letter: 'E', status: 'correct' },
];

const mockWordleBotAnalysis = {
  averageSkill: 88,
  averageLuck: 61,
  guessCount: 2,
  finalRemaining: 1,
  rows: [
    {
      attempt: 1,
      guess: 'TRACE',
      rank: 125,
      rankTotal: 14855,
      skillScore: 93,
      luckScore: 52,
      remainingBefore: 2355,
      remainingAfter: 87,
      expectedRemaining: 95.4,
      botGuess: 'CRANE',
    },
    {
      attempt: 2,
      guess: 'CRANE',
      rank: 1,
      rankTotal: 14855,
      skillScore: 99,
      luckScore: 99,
      remainingBefore: 87,
      remainingAfter: 1,
      expectedRemaining: 1,
      botGuess: 'CRANE',
    },
  ],
};

beforeEach(() => {
  wordleBotMock.selectLatestCompletedDailyGame.mockReset();
  wordleBotMock.analyzeCompletedDailyGame.mockReset();
  wordleBotMock.selectLatestCompletedDailyGame.mockImplementation(
    (stats) => stats?.completedDailyGames?.[0] || null,
  );
  wordleBotMock.analyzeCompletedDailyGame.mockReturnValue(mockWordleBotAnalysis);
});

describe('GameBoard', () => {
  it('renders 6 rows', () => {
    const { container } = render(
      <GameBoard guessResults={[]} currentGuess="" currentRow={0} />,
    );

    expect(container.querySelectorAll('.row')).toHaveLength(6);
  });

  it('shows completed rows with colored cells', () => {
    const { container } = render(
      <GameBoard guessResults={[completedRow]} currentGuess="" currentRow={1} />,
    );

    expect(container.querySelectorAll('.row').item(0).querySelectorAll('.correct')).toHaveLength(2);
    expect(container.querySelectorAll('.row').item(0).querySelectorAll('.present')).toHaveLength(1);
    expect(container.querySelectorAll('.row').item(0).querySelectorAll('.absent')).toHaveLength(2);
  });

  it('shows the current guess in the active row', () => {
    const { container } = render(
      <GameBoard guessResults={[completedRow]} currentGuess="AD" currentRow={1} />,
    );

    const activeCells = container.querySelectorAll('.row').item(1).querySelectorAll('.cell');
    expect(activeCells.item(0)).toHaveTextContent('A');
    expect(activeCells.item(1)).toHaveTextContent('D');
    expect(activeCells.item(0)).toHaveClass('filled');
  });
});

describe('Keyboard', () => {
  it('renders all letter keys plus Enter and Delete', () => {
    render(<Keyboard onKeyPress={vi.fn()} keyboardStatus={{}} disabled={false} />);

    expect(screen.getAllByRole('button')).toHaveLength(28);
    expect(screen.getByRole('button', { name: 'ENTER' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete letter' })).toBeInTheDocument();
  });

  it('calls onKeyPress with the clicked key', () => {
    const onKeyPress = vi.fn();
    render(<Keyboard onKeyPress={onKeyPress} keyboardStatus={{}} disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete letter' }));

    expect(onKeyPress).toHaveBeenNthCalledWith(1, 'A');
    expect(onKeyPress).toHaveBeenNthCalledWith(2, 'DELETE');
  });

  it('applies keyboard status classes', () => {
    render(
      <Keyboard
        onKeyPress={vi.fn()}
        keyboardStatus={{ A: 'correct', B: 'present', C: 'absent' }}
        disabled={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'A' })).toHaveClass('correct');
    expect(screen.getByRole('button', { name: 'B' })).toHaveClass('present');
    expect(screen.getByRole('button', { name: 'C' })).toHaveClass('absent');
  });

  it('does not call onKeyPress when disabled', () => {
    const onKeyPress = vi.fn();
    render(<Keyboard onKeyPress={onKeyPress} keyboardStatus={{}} disabled />);

    fireEvent.click(screen.getByRole('button', { name: 'A' }));

    expect(onKeyPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'A' })).toBeDisabled();
  });
});

describe('ModeSwitch', () => {
  it('renders Daily and Practice tabs', () => {
    render(<ModeSwitch mode="daily" onSwitch={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Daily' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Practice' })).toBeInTheDocument();
  });

  it('marks the active mode', () => {
    render(<ModeSwitch mode="practice" onSwitch={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveClass('mode-btn--active');
    expect(screen.getByRole('tab', { name: 'Daily' })).not.toHaveClass('mode-btn--active');
  });

  it('calls onSwitch with the clicked inactive mode', () => {
    const onSwitch = vi.fn();
    render(<ModeSwitch mode="daily" onSwitch={onSwitch} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Practice' }));

    expect(onSwitch).toHaveBeenCalledWith('practice');
  });
});

describe('Cell', () => {
  it('renders its letter value', () => {
    render(<Cell value="A" status="" />);

    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('applies status classes', () => {
    const { container, rerender } = render(<Cell value="A" status="correct" />);

    expect(container.firstChild).toHaveClass('cell', 'correct');
    rerender(<Cell value="A" status="present" />);
    expect(container.firstChild).toHaveClass('present');
    rerender(<Cell value="A" status="absent" />);
    expect(container.firstChild).toHaveClass('absent');
    rerender(<Cell value="A" status="filled" />);
    expect(container.firstChild).toHaveClass('filled');
  });

  it('sets animation delay for reveal statuses', () => {
    const { container } = render(<Cell value="A" status="correct" revealDelay={0.2} />);

    expect(container.firstChild).toHaveStyle({ animationDelay: '0.2s' });
  });
});

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Test modal">
        <p>Modal child content</p>
      </Modal>,
    );

    expect(screen.getByText('Modal child content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test modal">
        <p>Hidden content</p>
      </Modal>,
    );

    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen onClose={onClose} title="Test modal">
        <p>Modal child content</p>
      </Modal>,
    );

    fireEvent.click(container.querySelector('.modal-overlay'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ResultsPanel', () => {
  const guessResults = [
    completedRow,
    completedRow.map((cell) => ({ ...cell, status: 'correct' })),
  ];

  it('renders daily results with stats and highlights the winning attempt', () => {
    const stats = {
      gamesPlayed: 12,
      winPercentage: 75,
      currentStreak: 3,
      maxStreak: 5,
      guessDistribution: { 1: 0, 2: 4, 3: 8 },
    };

    const { container } = render(
      <ResultsPanel
        isOpen
        onClose={vi.fn()}
        gameStatus="WON"
        attempts={2}
        user={{ id: 'user-1' }}
        stats={stats}
        isStatsLoading={false}
        statsError={null}
        guessResults={guessResults}
        gameDate="2026-05-27"
        onToast={vi.fn()}
      />,
    );

    expect(screen.getByText('Thanks for playing today!')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(container.querySelector('.results-bar-row--highlight .results-bar-label'))
      .toHaveTextContent('2');
  });

  it('shows guest stats prompt and closes from Back to puzzle', () => {
    const onClose = vi.fn();
    render(
      <ResultsPanel
        isOpen
        onClose={onClose}
        gameStatus="LOST"
        attempts={6}
        user={null}
        stats={null}
        isStatsLoading={false}
        statsError={null}
        guessResults={guessResults}
        gameDate="2026-05-27"
        onToast={vi.fn()}
      />,
    );

    expect(screen.getByText('Login to see your stats')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back to puzzle'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders badge callouts earned by the finished daily game', () => {
    const perfectGuessResults = [
      [
        { letter: 'C', status: 'correct' },
        { letter: 'R', status: 'correct' },
        { letter: 'A', status: 'correct' },
        { letter: 'N', status: 'correct' },
        { letter: 'E', status: 'correct' },
      ],
    ];

    render(
      <ResultsPanel
        isOpen
        onClose={vi.fn()}
        gameStatus="WON"
        attempts={1}
        user={null}
        stats={null}
        isStatsLoading={false}
        statsError={null}
        guessResults={perfectGuessResults}
        submittedWords={['CRANE']}
        targetWord="CRANE"
        gameDate="2026-05-27"
        onToast={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Badges earned' })).toBeInTheDocument();
    expect(screen.getByText('Sea of Greens')).toBeInTheDocument();
    expect(screen.getByText('Wordle In 1')).toBeInTheDocument();
    expect(screen.getAllByText('Earned this daily')).toHaveLength(2);
  });
});

describe('StatsModal', () => {
  const stats = {
    gamesPlayed: 173,
    gamesWon: 164,
    winPercentage: 95,
    currentStreak: 59,
    maxStreak: 59,
    guessDistribution: { 1: 0, 2: 3, 3: 26, 4: 60, 5: 12, 6: 1 },
    completedDailyGames: [
      {
        id: 'daily-1',
        gameDate: '2026-05-27T00:00:00.000Z',
        completedAt: '2026-05-27T12:00:00.000Z',
        status: 'WON',
        attempts: 2,
        targetWord: 'CRANE',
        guesses: ['TRACE', 'CRANE'],
      },
    ],
  };

  it('renders summary, badges, distribution, and Wordle Bot action', () => {
    const { container } = render(
      <StatsModal
        isOpen
        onClose={vi.fn()}
        user={{ id: 'user-1' }}
        stats={stats}
        isLoading={false}
        error={null}
        refetch={vi.fn()}
        highlightAttempt={4}
      />,
    );

    expect(screen.getByText('173')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Badges' })).toBeInTheDocument();
    expect(screen.getByText('Tap on any badge to view it in detail')).toBeInTheDocument();
    expect(screen.getByText('Sea of Greens')).toBeInTheDocument();
    expect(screen.getByText('100-Day Streak')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guess Distribution' })).toBeInTheDocument();
    expect(screen.getByText('Analyze your 2026-05-27 guesses against the full word list.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Wordle Bot' })).toBeEnabled();

    const headings = Array.from(container.querySelectorAll('.stats-content-scrollable h3'))
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Badges', 'Guess Distribution', 'Wordle Bot']);
  });

  it('opens badge detail on click', () => {
    render(
      <StatsModal
        isOpen
        onClose={vi.fn()}
        user={{ id: 'user-1' }}
        stats={stats}
        isLoading={false}
        error={null}
        refetch={vi.fn()}
        highlightAttempt={4}
      />,
    );

    fireEvent.click(screen.getByText('100-Day Streak'));

    expect(screen.getByText('Build a 100-day daily winning streak.')).toBeInTheDocument();
    expect(screen.getByText('59/100 days')).toBeInTheDocument();
  });

  it('disables Wordle Bot when no completed daily game is available', () => {
    wordleBotMock.selectLatestCompletedDailyGame.mockReturnValue(null);

    render(
      <StatsModal
        isOpen
        onClose={vi.fn()}
        user={{ id: 'user-1' }}
        stats={{ ...stats, completedDailyGames: [] }}
        isLoading={false}
        error={null}
        refetch={vi.fn()}
        highlightAttempt={4}
      />,
    );

    expect(screen.getByText('Complete a daily game to unlock Wordle Bot analysis.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Wordle Bot' })).toBeDisabled();
  });

  it('expands a real Wordle Bot analysis panel from the action button', async () => {
    render(
      <StatsModal
        isOpen
        onClose={vi.fn()}
        user={{ id: 'user-1' }}
        stats={stats}
        isLoading={false}
        error={null}
        refetch={vi.fn()}
        highlightAttempt={4}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Wordle Bot' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Analyzing the latest completed daily game...',
    );
    expect(await screen.findByText('Avg Skill')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('TRACE')).toBeInTheDocument();
    expect(screen.getAllByText('CRANE')).toHaveLength(3);
    expect(screen.getByText('#125 of 14,855')).toBeInTheDocument();
    expect(wordleBotMock.analyzeCompletedDailyGame)
      .toHaveBeenCalledWith(stats.completedDailyGames[0]);
  });
});
