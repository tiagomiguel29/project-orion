import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  function make() {
    const realtime = {
      deviceRoom: (id: string) => `device:${id}`,
      setServer: jest.fn(),
    };
    const gateway = new RealtimeGateway(realtime as any, null);
    return { gateway };
  }

  it('is defined', () => {
    expect(make().gateway).toBeDefined();
  });

  it('subscribeDashboard joins the dashboard room', async () => {
    const { gateway } = make();
    const socket = { join: jest.fn() };
    const res = await gateway.subscribeDashboard(socket as any);
    expect(socket.join).toHaveBeenCalledWith('dashboard');
    expect(res.ok).toBe(true);
  });

  it('subscribeDevice joins the device room', async () => {
    const { gateway } = make();
    const socket = { join: jest.fn() };
    const res = await gateway.subscribeDevice({ deviceId: 'dev-1' }, socket as any);
    expect(socket.join).toHaveBeenCalledWith('device:dev-1');
    expect(res.ok).toBe(true);
  });

  it('subscribeDevice rejects a missing deviceId', async () => {
    const { gateway } = make();
    const socket = { join: jest.fn() };
    const res = await gateway.subscribeDevice({ deviceId: '' }, socket as any);
    expect(res.ok).toBe(false);
    expect(socket.join).not.toHaveBeenCalled();
  });
});
