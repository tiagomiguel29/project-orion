import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  function make() {
    const devicesRepo = { find: jest.fn(), findOne: jest.fn() } as any;
    const metricsRepo = { createQueryBuilder: jest.fn() } as any;
    const config = { get: (_k: string, d?: any) => d } as any;
    return new DashboardService(devicesRepo, metricsRepo, config);
  }

  it('is defined', () => {
    expect(make()).toBeDefined();
  });

  it('maps OS to the primary disk mount (Windows vs POSIX)', () => {
    const service = make();
    // getOsDiskMounts is private; exercise it via the instance.
    const mounts = (service as any).getOsDiskMounts([
      { externalId: 'win-1', os: 'windows' },
      { externalId: 'lin-1', os: 'linux' },
    ]);
    expect(mounts.get('win-1')).toBe('C:\\');
    expect(mounts.get('lin-1')).toBe('/');
  });
});
