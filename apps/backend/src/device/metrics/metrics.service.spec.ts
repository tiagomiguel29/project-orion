import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('chunks bulk inserts and maps points to rows', async () => {
    const insert = jest.fn().mockResolvedValue(undefined);
    const repo = { insert } as any;
    const service = new MetricsService(repo);

    const points = Array.from({ length: 2500 }, (_, i) => ({
      name: 'cpu.percent',
      value: i,
      tsUnixMs: 1000 + i,
    }));

    await service.insertMany('dev-1', points, 1000);

    // 2500 rows / 1000 per chunk = 3 inserts
    expect(insert).toHaveBeenCalledTimes(3);
    const firstRow = insert.mock.calls[0][0][0];
    expect(firstRow).toMatchObject({ deviceId: 'dev-1', name: 'cpu.percent' });
    expect(firstRow.time).toBeInstanceOf(Date);
  });

  it('is a no-op for an empty batch', async () => {
    const insert = jest.fn();
    const service = new MetricsService({ insert } as any);
    await service.insertMany('dev-1', []);
    expect(insert).not.toHaveBeenCalled();
  });
});
