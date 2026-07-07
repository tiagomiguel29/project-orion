import { DeviceController } from './device.controller';

describe('DeviceController', () => {
  function make() {
    const devices = {
      createDevice: jest.fn(),
      deleteDevice: jest.fn().mockResolvedValue(undefined),
    };
    const agents = {
      mintEnrollment: jest.fn().mockReturnValue('enroll-token'),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    const dashboard = {
      getDashboardPayload: jest.fn(),
      getDeviceDashboardPayload: jest.fn(),
    };
    const controller = new DeviceController(
      devices as any,
      agents as any,
      dashboard as any,
    );
    return { controller, devices, agents };
  }

  it('is defined', () => {
    expect(make().controller).toBeDefined();
  });

  it('mints an enrollment token on device creation', async () => {
    const { controller, devices, agents } = make();
    devices.createDevice.mockResolvedValue({ externalId: 'dev-1' });

    await controller.createDevice({ externalId: 'dev-1' } as any, {} as any);

    expect(agents.mintEnrollment).toHaveBeenCalledWith('dev-1');
  });

  it('revokes credentials when a device is deleted', async () => {
    const { controller, agents } = make();
    await controller.deleteDevice('dev-1');
    expect(agents.revoke).toHaveBeenCalledWith('dev-1');
  });

  it('revokes on demand via the revoke endpoint', async () => {
    const { controller, agents } = make();
    await controller.revokeDevice('dev-1');
    expect(agents.revoke).toHaveBeenCalledWith('dev-1');
  });
});
