import { DeviceService } from './device.service';

describe('DeviceService', () => {
  function make() {
    const devicesRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (d) => d),
      create: jest.fn().mockImplementation((d) => d),
    };
    const metricsRepo = {} as any;
    const eventsRepo = {} as any;
    const realtime = { emitToDevice: jest.fn(), emitToDashboard: jest.fn() };
    const service = new DeviceService(
      devicesRepo as any,
      metricsRepo,
      eventsRepo,
      realtime as any,
    );
    return { service, devicesRepo, realtime };
  }

  it('is defined', () => {
    expect(make().service).toBeDefined();
  });

  it('markSeen fast-path only updates lastSeenAt when already online', async () => {
    const { service, devicesRepo, realtime } = make();
    devicesRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      externalId: 'dev-1',
      status: 'online',
    });

    await service.markSeen('dev-1');

    expect(devicesRepo.update).toHaveBeenCalledWith(
      'uuid-1',
      expect.objectContaining({ lastSeenAt: expect.any(Date) }),
    );
    // no status transition → no WS emit
    expect(realtime.emitToDevice).not.toHaveBeenCalled();
  });

  it('markSeen emits a status change when a device comes online', async () => {
    const { service, devicesRepo, realtime } = make();
    devicesRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      externalId: 'dev-1',
      status: 'offline',
    });

    await service.markSeen('dev-1');

    expect(devicesRepo.save).toHaveBeenCalled();
    expect(realtime.emitToDevice).toHaveBeenCalledWith(
      'dev-1',
      'device.status',
      expect.objectContaining({ status: 'online' }),
    );
  });
});
