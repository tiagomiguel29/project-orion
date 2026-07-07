import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  it('claims a new batch and rejects a duplicate', async () => {
    const store = new Map<string, string>();
    const redis = {
      set: jest.fn(async (key: string, _v: string, _ex: string, _ttl: number, nx: string) => {
        if (nx === 'NX' && store.has(key)) return null;
        store.set(key, '1');
        return 'OK';
      }),
      del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    };
    const svc = new IdempotencyService(redis as any);

    await expect(svc.claim('b1')).resolves.toBe(true); // first time → claimed
    await expect(svc.claim('b1')).resolves.toBe(false); // replay → duplicate
  });

  it('release lets a later attempt re-claim (retry after failure)', async () => {
    const store = new Map<string, string>();
    const redis = {
      set: jest.fn(async (key: string, _v: string, _ex: string, _ttl: number, nx: string) => {
        if (nx === 'NX' && store.has(key)) return null;
        store.set(key, '1');
        return 'OK';
      }),
      del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    };
    const svc = new IdempotencyService(redis as any);

    await expect(svc.claim('b2')).resolves.toBe(true);
    await svc.release('b2');
    await expect(svc.claim('b2')).resolves.toBe(true); // re-claimable after release
  });

  it('degrades to no-dedup when Redis is unavailable', async () => {
    const svc = new IdempotencyService(null);
    await expect(svc.claim('b3')).resolves.toBe(true);
    await expect(svc.claim('b3')).resolves.toBe(true);
  });

  it('treats a missing batch id as always processable', async () => {
    const svc = new IdempotencyService(null);
    await expect(svc.claim('')).resolves.toBe(true);
  });
});
