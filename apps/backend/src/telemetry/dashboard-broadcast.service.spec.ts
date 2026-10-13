import { DashboardBroadcastService } from './dashboard-broadcast.service';

describe('Cluster dashboard throttle', () => {
  it('allows only one replica per device/window', async () => {
    const redis = { set: jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null) };
    const service = new DashboardBroadcastService(redis as any);
    await expect(service.allowDashboardEmit('dev-1', 2000)).resolves.toBe(true);
    await expect(service.allowDashboardEmit('dev-1', 2000)).resolves.toBe(false);
    expect(redis.set).toHaveBeenCalledWith('dashboard:emit:dev-1', '1', 'PX', 2000, 'NX');
  });

  it('supports single-instance development without Redis', async () => {
    await expect(new DashboardBroadcastService(null).allowDashboardEmit('dev-1', 2000)).resolves.toBe(true);
  });
});
