import { RedisLockService } from './redis-lock.service';

function makeRedis() {
  const store = new Map<string, string>();
  return {
    set: jest.fn(
      async (k: string, v: string, _px: string, _ttl: number, nx: string) => {
        if (nx === 'NX' && store.has(k)) return null;
        store.set(k, v);
        return 'OK';
      },
    ),
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
  };
}

describe('RedisLockService', () => {
  it('runs fn under the lock and releases it', async () => {
    const redis = makeRedis();
    const lock = new RedisLockService(redis as any);
    await expect(lock.withLock('k', 1000, async () => 42)).resolves.toBe(42);
    await expect(redis.get('k')).resolves.toBeNull(); // released
  });

  it('runs on exactly one of two concurrent holders (the other is skipped)', async () => {
    const redis = makeRedis();
    const lock = new RedisLockService(redis as any);
    let running = 0;
    let maxConcurrent = 0;
    const fn = async () => {
      running++;
      maxConcurrent = Math.max(maxConcurrent, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
      return 'ran';
    };
    const results = await Promise.all([
      lock.withLock('k', 1000, fn),
      lock.withLock('k', 1000, fn),
    ]);
    expect(results.filter((r) => r === 'ran')).toHaveLength(1);
    expect(results.filter((r) => r === undefined)).toHaveLength(1);
    expect(maxConcurrent).toBe(1);
  });

  it('runs locally (no lock) when Redis is unavailable', async () => {
    const lock = new RedisLockService(null);
    await expect(lock.withLock('k', 1000, async () => 7)).resolves.toBe(7);
  });
});
