import { describe, expect, it } from 'vitest';
import { prismaMock } from '../../../test/setup.js';
import { getPlayerStats } from '../stats.service.js';

describe('getPlayerStats', () => {
    it('returns completed daily games with guesses and target words for badge computation', async () => {
        prismaMock.dailyGame.count
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(1);
        prismaMock.user.findUnique.mockResolvedValueOnce({
            currentStreak: 1,
            maxStreak: 4,
        });
        prismaMock.dailyGame.groupBy.mockResolvedValueOnce([
            { attempts: 2, _count: { _all: 1 } },
        ]);
        prismaMock.dailyGame.findMany.mockResolvedValueOnce([
            {
                id: 'game-1',
                gameDate: new Date('2026-05-27T00:00:00.000Z'),
                completedAt: new Date('2026-05-27T12:00:00.000Z'),
                status: 'WON',
                attempts: 2,
                dailyWord: { word: 'CRANE' },
                guesses: [
                    { guessWord: 'BLIMP' },
                    { guessWord: 'CRANE' },
                ],
            },
        ]);

        const stats = await getPlayerStats('user-1');

        expect(prismaMock.dailyGame.findMany).toHaveBeenCalledWith({
            where: {
                userId: 'user-1',
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
        });
        expect(stats.completedDailyGames).toEqual([
            {
                id: 'game-1',
                gameDate: '2026-05-27T00:00:00.000Z',
                completedAt: '2026-05-27T12:00:00.000Z',
                status: 'WON',
                attempts: 2,
                targetWord: 'CRANE',
                guesses: ['BLIMP', 'CRANE'],
            },
        ]);
    });
});
