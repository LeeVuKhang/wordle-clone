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

function game(overrides: Record<string, unknown> = {}) {
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

describe('GET /api/game/today', () => {
    it('returns a new guest game with a Base64 word and empty progress', async () => {
        prismaMock.dailyGame.findUnique.mockResolvedValueOnce(null);
        prismaMock.dailyGame.create.mockResolvedValueOnce(game());

        const res = await request(app)
            .get('/api/game/today')
            .set('X-Guest-ID', GUEST_UUID);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            id: 'game-1',
            word: Buffer.from('CRANE').toString('base64'),
            guesses: [],
            attempts: 0,
            status: 'PLAYING',
        });
        expect(prismaMock.dailyGame.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ guestUuid: GUEST_UUID }),
            }),
        );
    });

    it('returns a word that decodes to a valid 5-letter string', async () => {
        prismaMock.dailyGame.findUnique.mockResolvedValueOnce(null);
        prismaMock.dailyGame.create.mockResolvedValueOnce(game());

        const res = await request(app)
            .get('/api/game/today')
            .set('X-Guest-ID', GUEST_UUID);

        expect(Buffer.from(res.body.word, 'base64').toString('utf8')).toMatch(/^[A-Z]{5}$/);
    });

    it('returns existing progress for an authenticated user', async () => {
        prismaMock.dailyGame.findUnique.mockResolvedValueOnce(game({
            id: 'user-game-1',
            userId: USER_ID,
            guestUuid: null,
            attempts: 2,
            status: 'PLAYING',
            guesses: [
                { guessWord: 'ADIEU', attemptNumber: 1 },
                { guessWord: 'TRACE', attemptNumber: 2 },
            ],
        }));

        const res = await request(app)
            .get('/api/game/today')
            .set('Cookie', [`access_token=${accessToken()}`]);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            id: 'user-game-1',
            guesses: ['ADIEU', 'TRACE'],
            attempts: 2,
            status: 'PLAYING',
        });
        expect(prismaMock.dailyGame.create).not.toHaveBeenCalled();
    });

    it('returns a completed game without creating a new one', async () => {
        prismaMock.dailyGame.findUnique.mockResolvedValueOnce(game({
            attempts: 3,
            status: 'WON',
            guesses: [
                { guessWord: 'ADIEU', attemptNumber: 1 },
                { guessWord: 'TRACE', attemptNumber: 2 },
                { guessWord: 'CRANE', attemptNumber: 3 },
            ],
        }));

        const res = await request(app)
            .get('/api/game/today')
            .set('X-Guest-ID', GUEST_UUID);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('WON');
        expect(res.body.guesses).toEqual(['ADIEU', 'TRACE', 'CRANE']);
        expect(prismaMock.dailyGame.create).not.toHaveBeenCalled();
    });

    it('returns 401 when no user or guest identity is provided', async () => {
        const res = await request(app).get('/api/game/today');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
});
