import { MetricsService } from './metrics.service';

function make() {
  const builder: any = {};
  for (const method of ['insert', 'into', 'values', 'orIgnore', 'returning']) builder[method] = jest.fn().mockReturnValue(builder);
  builder.execute = jest.fn().mockResolvedValue({ raw: [{ batchId: 'b1' }] });
  const manager = { createQueryBuilder: () => builder, insert: jest.fn().mockResolvedValue(undefined) };
  const transaction = jest.fn(async (callback) => callback(manager));
  const service = new MetricsService({ manager: { transaction } } as any);
  return { service, manager, transaction, builder };
}

describe('MetricsService transactional batches', () => {
  it('commits a receipt and all chunks inside one transaction', async () => {
    const { service, manager, transaction } = make();
    const points = Array.from({ length: 2500 }, (_, i) => ({ name: 'cpu.percent', value: i, tsUnixMs: 1000 + i }));
    await expect(service.insertBatches('dev-1', [{ batchId: 'b1', points }])).resolves.toEqual([true]);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(manager.insert).toHaveBeenCalledTimes(3);
    expect(manager.insert.mock.calls[0][1][0]).toMatchObject({ deviceId: 'dev-1', time: expect.any(Date) });
  });

  it('skips metrics when a committed receipt already exists', async () => {
    const { service, manager, builder } = make();
    builder.execute.mockResolvedValue({ raw: [] });
    await expect(service.insertBatches('dev-1', [{ batchId: 'b1', points: [{ name: 'cpu', value: 1, tsUnixMs: 1 }] }])).resolves.toEqual([false]);
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('propagates chunk failures to the transaction instead of acknowledging success', async () => {
    const { service, manager } = make();
    manager.insert.mockRejectedValueOnce(new Error('chunk failed'));
    await expect(service.insertBatches('dev-1', [{ batchId: 'b1', points: [{ name: 'cpu', value: 1, tsUnixMs: 1 }] }])).rejects.toThrow('chunk failed');
  });
});
