/**
 * Stats Service - derived player stats and cached leaderboard data.
 *
 * @see WBS Tasks 9.4, 9.5, 10.7
 */

import { prisma } from '../../lib/prisma.js';
import { redis, REDIS_KEYS, REDIS_TTL } from '../../lib/redis.js';
import { recordHit, recordMiss } from '../../lib/cacheMetrics.js';
import type {
    LeaderboardEntryDTO,
    LeaderboardResponseDTO,
    PlayerStatsDTO,
} from './stats.types.js';

const LEADERBOARD_REFRESH_MS = REDIS_TTL.LEADERBOARD_REFRESH * 1000;

function createEmptyDistribution(): Record<string, number> {
    return {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
        '6': 0,
    };
}

function withRefreshWindow(entries: LeaderboardEntryDTO[]): LeaderboardResponseDTO {
    const cachedAtDate = new Date();
    const nextRefreshDate = new Date(cachedAtDate.getTime() + LEADERBOARD_REFRESH_MS);

    return {
        entries,
        cachedAt: cachedAtDate.toISOString(),
        nextRefresh: nextRefreshDate.toISOString(),
    };
}

export async function getPlayerStats(userId: string): Promise<PlayerStatsDTO> {
    const [gamesPlayed, gamesWon, user, groupedWins, completedGames] = await Promise.all([
        prisma.dailyGame.count({ where: { userId } }),
        prisma.dailyGame.count({ where: { userId, status: 'WON' } }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { currentStreak: true, maxStreak: true },
        }),
        prisma.dailyGame.groupBy({
            by: ['attempts'],
            where: { userId, status: 'WON' },
            _count: { _all: true },
        }),
        prisma.dailyGame.findMany({
            where: {
                userId,
                status: { in: ['WON', 'LOST'] },
            },
            orderBy: { gameDate: 'desc' },
            select: {
                id: true,
                gameDate: true,
                completedAt: true,
                status: true,
                attempts: true,
                dailyWord: {
                    select: { word: true },
                },
                guesses: {
                    orderBy: { attemptNumber: 'asc' },
                    select: { guessWord: true },
                },
            },
        }),
    ]);

    if (!user) {
        throw new Error('User not found');
    }

    const guessDistribution = createEmptyDistribution();
    for (const row of groupedWins) {
        if (row.attempts >= 1 && row.attempts <= 6) {
            guessDistribution[String(row.attempts)] = row._count._all;
        }
    }

    return {
        gamesPlayed,
        gamesWon,
        winPercentage: gamesPlayed === 0 ? 0 : (gamesWon / gamesPlayed) * 100,
        currentStreak: user.currentStreak,
        maxStreak: user.maxStreak,
        guessDistribution,
        completedDailyGames: completedGames.map((game) => ({
            id: game.id,
            gameDate: game.gameDate.toISOString(),
            completedAt: game.completedAt?.toISOString() ?? null,
            status: game.status as 'WON' | 'LOST',
            attempts: game.attempts,
            targetWord: game.dailyWord.word,
            guesses: game.guesses.map((guess) => guess.guessWord),
        })),
    };
}

export async function getLeaderboard(): Promise<LeaderboardResponseDTO> {
    try {
        const cached = await redis.get<LeaderboardResponseDTO>(REDIS_KEYS.LEADERBOARD_DATA);

        if (cached) {
            recordHit('leaderboard_data');
            const shouldRefresh = await setLeaderboardRefreshSentinel();
            if (shouldRefresh) {
                void refreshLeaderboardCache().catch((err) => {
                    console.warn('Leaderboard background refresh failed:', err);
                    void redis.del(REDIS_KEYS.LEADERBOARD_REFRESH).catch(() => {
                        // Best-effort cleanup only. The sentinel TTL still bounds the retry delay.
                    });
                });
            }
            return cached;
        }

        recordMiss('leaderboard_data');
        await setLeaderboardRefreshSentinel();
        return await refreshLeaderboardCache();
    } catch {
        recordMiss('leaderboard_data');
        return withRefreshWindow(await queryLeaderboardEntries());
    }
}

async function setLeaderboardRefreshSentinel(): Promise<boolean> {
    const result = await redis.set(REDIS_KEYS.LEADERBOARD_REFRESH, '1', {
        ex: REDIS_TTL.LEADERBOARD_REFRESH,
        nx: true,
    });
    const acquired = result !== null;

    if (acquired) {
        recordMiss('leaderboard_sentinel');
    } else {
        recordHit('leaderboard_sentinel');
    }

    return acquired;
}

async function refreshLeaderboardCache(): Promise<LeaderboardResponseDTO> {
    const response = withRefreshWindow(await queryLeaderboardEntries());

    await redis.set(REDIS_KEYS.LEADERBOARD_DATA, response, {
        ex: REDIS_TTL.LEADERBOARD_DATA,
    });

    return response;
}

async function queryLeaderboardEntries(): Promise<LeaderboardEntryDTO[]> {
    const users = await prisma.user.findMany({
        where: { maxStreak: { gt: 0 } },
        orderBy: [
            { maxStreak: 'desc' },
            { currentStreak: 'desc' },
            { username: 'asc' },
        ],
        take: 100,
        select: {
            username: true,
            maxStreak: true,
            currentStreak: true,
            _count: {
                select: {
                    dailyGames: {
                        where: { status: 'WON' },
                    },
                },
            },
        },
    });

    return users.map((user, index) => ({
        rank: index + 1,
        username: user.username || 'Anonymous',
        maxStreak: user.maxStreak,
        currentStreak: user.currentStreak,
        gamesWon: user._count.dailyGames,
    }));
}
