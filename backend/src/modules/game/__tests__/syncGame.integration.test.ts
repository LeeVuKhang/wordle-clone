import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prismaMock } from '../../../test/setup.js';
import { createTestApp } from '../../../test/testApp.js';

const app = createTestApp();
const GUEST_UUID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-1';
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function accessToken(userId = USER_ID): string {
    return jwt.sign(
        { sub: userId, email: `${userId}@example.com`, type: 'access' },
        SECRET,
        { expiresIn: '15m' },
    );
}

function playingGame(overrides: Record<string, unknown> = {}) {
    return {
        id: 'game-1',
        userId: null,
        guestUuid: GUEST_UUID,
        attempts: 0,
        status: 'PLAYING',
        guesses: [],
        ...overrides,
    };
}

describe('POST /api/game/sync', () => {
    it('returns 401 when no user or guest identity is provided', async () => {
        const res = await request(app)
            .post('/api/game/sync')
            .send({ id: 'game-1', guesses: ['ADIEU'], status: 'PLAYING' });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('persists guesses, updates attempts, and returns the updated state', async () => {
        prismaMock.dailyGame.findUnique.mockResolvedValueOnce(playingGame());

        const res = await request(app)
            .post('/api/game/sync')
            .set('X-Guest-ID', GUEST_UUID)
            .send({ id: 'game-1', guesses: ['adieu', 'crane'], status: 'WON' });

        expect(res.status).toBe(200);
        expect(prismaMock.dailyGuess.deleteMany).toHaveBeenCalledWith({ where: { gameId: 'game-1' } });
        expect(prismaMock.dailyGuess.createMany).toHaveBeenCalledWith({
            data: [
                { gameId: 'game-1', guessWord: 'ADIEU', attemptNumber: 1 },
                { gameId: 'game-1', guessWord: 'CRANE', attemptNumber: 2 },
            ],
        });
        expect(prismaMock.dailyGame.update).toHaveBeenCalledWith({
            where: { id: 'game-1' },
            data: expect.objectContaining({
                attempts: 2,
                status: 'WON',
                completedAt: expect.any(Date),
            }),
        });
        expect(res.body).toEqual({
            id: 'game-1',
            word: Buffer.from('CRANE').toString('base64'),
            guesses: ['ADIEU', 'CRANE'],
            attempts: 2,
            status: 'WON',
        });
    });

    it('rejects a missing game ID with 404', async () => {
        prismaMock.dailyGame.findUnique.mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/api/game/sync')
            .set('X-Guest-ID', GUEST_UUID)
            .send({ id: 'missing-game', guesses: ['ADIEU'], status: 'PLAYING' });

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('GAME_NOT_FOUND');
    });

    it("rejects a user who does not own the game with 403", async () => {
        prismaMock.dailyGame.findUnique.mockResolvedValueOnce(playingGame({
            userId: 'owner-user',
            guestUuid: null,
        }));

        const res = await request(app)
            .post('/api/game/sync')
            .set('Cookie', [`access_token=${accessToken('other-user')}`])
            .send({ id: 'game-1', guesses: ['ADIEU'], status: 'PLAYING' });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns an already completed game without changing it', async () => {
        prismaMock.dailyGame.findUnique.mockResolvedValueOnce(playingGame({
            attempts: 2,
            status: 'WON',
            guesses: [
                { guessWord: 'ADIEU', attemptNumber: 1 },
                { guessWord: 'CRANE', attemptNumber: 2 },
            ],
        }));

        const res = await request(app)
            .post('/api/game/sync')
            .set('X-Guest-ID', GUEST_UUID)
            .send({ id: 'game-1', guesses: ['SPEED'], status: 'LOST' });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            guesses: ['ADIEU', 'CRANE'],
            attempts: 2,
            status: 'WON',
        });
        expect(prismaMock.dailyGuess.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.dailyGame.update).not.toHaveBeenCalled();
    });

    it('rejects non-5-letter guesses with 400', async () => {
        const res = await request(app)
            .post('/api/game/sync')
            .set('X-Guest-ID', GUEST_UUID)
            .send({ id: 'game-1', guesses: ['TOO'], status: 'PLAYING' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-alpha guesses with 400', async () => {
        const res = await request(app)
            .post('/api/game/sync')
            .set('X-Guest-ID', GUEST_UUID)
            .send({ id: 'game-1', guesses: ['AB1DE'], status: 'PLAYING' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
});
