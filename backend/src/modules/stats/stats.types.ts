/**
 * Stats Types - player statistics and leaderboard DTOs.
 *
 * @see WBS Tasks 9.4, 9.5
 * @see docs/API.md Section 5
 */

export interface PlayerStatsDTO {
    gamesPlayed: number;
    gamesWon: number;
    winPercentage: number;
    currentStreak: number;
    maxStreak: number;
    guessDistribution: Record<string, number>;
    completedDailyGames: CompletedDailyGameDTO[];
}

export interface CompletedDailyGameDTO {
    id: string;
    gameDate: string;
    completedAt: string | null;
    status: 'WON' | 'LOST';
    attempts: number;
    targetWord: string;
    guesses: string[];
}

export interface LeaderboardEntryDTO {
    rank: number;
    username: string;
    maxStreak: number;
    currentStreak: number;
    gamesWon: number;
}

export interface LeaderboardResponseDTO {
    entries: LeaderboardEntryDTO[];
    cachedAt: string;
    nextRefresh: string;
}
