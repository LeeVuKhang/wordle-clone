import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalNodeEnv = process.env.NODE_ENV;

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];
        return;
    }

    process.env[name] = value;
}

afterEach(() => {
    restoreEnvironmentVariable('UPSTASH_REDIS_REST_URL', originalRedisUrl);
    restoreEnvironmentVariable('UPSTASH_REDIS_REST_TOKEN', originalRedisToken);
    restoreEnvironmentVariable('NODE_ENV', originalNodeEnv);
    delete (globalThis as typeof globalThis & { redis?: unknown }).redis;
    vi.resetModules();
});

describe('Redis client failure handling', () => {
    it('fails a slow Redis command within the fallback budget without retrying', async () => {
        let requestCount = 0;
        const server = createServer((_req, res) => {
            requestCount += 1;
            setTimeout(() => {
                if (!res.destroyed && !res.writableEnded) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end('{"error":"unavailable"}');
                }
            }, 3_000);
        });

        await new Promise<void>((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });

        try {
            const address = server.address();
            if (!address || typeof address === 'string') {
                throw new Error('Test Redis server did not bind to a TCP port');
            }

            process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${address.port}`;
            process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
            process.env.NODE_ENV = 'production';
            delete (globalThis as typeof globalThis & { redis?: unknown }).redis;
            vi.resetModules();
            vi.doUnmock('../redis.js');

            const { redis } = await import('../redis.js');
            const pingResult = redis.ping().then(
                () => 'resolved',
                () => 'failed'
            );
            const outcome = await Promise.race([
                pingResult,
                new Promise<'deadline'>((resolve) => {
                    setTimeout(() => resolve('deadline'), 1_800);
                }),
            ]);

            expect(outcome).toBe('failed');
            expect(requestCount).toBe(1);
        } finally {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
            });
        }
    }, 5_000);
});
