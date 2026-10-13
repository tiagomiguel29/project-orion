import { MetricsQueueService } from './metrics-queue.service';
import { MetricsService } from '../metrics/metrics.service';

describe('MetricsQueueService (ack-on-commit)', () => {
  let service: MetricsQueueService;
  let insertBatches: jest.Mock;

  beforeEach(() => {
    insertBatches = jest.fn().mockImplementation(async (_id, batches) => batches.map(() => true));
    const metrics = { insertBatches } as unknown as MetricsService;
    // Construct directly to avoid starting the flush timer (onModuleInit).
    service = new MetricsQueueService(metrics);
  });

  it('resolves enqueue only after a successful commit', async () => {
    await expect(
      service.enqueue('dev-1', [{ name: 'cpu', value: 1, tsUnixMs: 1 }]),
    ).resolves.toBe(true);
    expect(insertBatches).toHaveBeenCalledTimes(1);
  });

  it('rejects enqueue when persistence fails (agent should RETRY)', async () => {
    insertBatches.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.enqueue('dev-1', [{ name: 'cpu', value: 1, tsUnixMs: 1 }]),
    ).rejects.toThrow('db down');
  });

  it('resolves immediately for an empty batch without touching the DB', async () => {
    await expect(service.enqueue('dev-1', [])).resolves.toBe(true);
    expect(insertBatches).not.toHaveBeenCalled();
  });

  it('rejects oversized point batches before allocating a persistence queue item', async () => {
    const points = Array.from({ length: 100001 }, () => ({ name: 'cpu', value: 1, tsUnixMs: 1 }));
    await expect(service.enqueue('dev-1', points)).rejects.toThrow(/queue full/i);
    expect(insertBatches).not.toHaveBeenCalled();
  });

  it('rejects when the queue is full (backpressure)', async () => {
    // Fill past the safety cap without flushing by making inserts hang.
    let release!: () => void;
    insertBatches.mockImplementation(
      () => new Promise<boolean[]>((r) => (release = () => r([true]))),
    );
    const pending: Promise<unknown>[] = [];
    // One item is spliced into the (hanging) in-flight flush; the remaining
    // 5000 fill the queue up to the safety cap.
    for (let i = 0; i < 5001; i++) {
      pending.push(
        service
          .enqueue('dev-1', [{ name: 'cpu', value: i, tsUnixMs: i }])
          .catch(() => {}),
      );
    }
    await expect(
      service.enqueue('dev-1', [{ name: 'cpu', value: 1, tsUnixMs: 1 }]),
    ).rejects.toThrow(/queue full/i);
    release();
  });
});
