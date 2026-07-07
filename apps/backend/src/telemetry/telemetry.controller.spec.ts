import { TelemetryController } from './telemetry.controller';
import { IngestStatus } from './ingest-status';

function makeController(overrides: {
  claim?: jest.Mock;
  release?: jest.Mock;
  enqueue?: jest.Mock;
}) {
  const realtime = { emitToDevice: jest.fn(), emitToDashboard: jest.fn() };
  const metricsQueue = {
    enqueue: overrides.enqueue ?? jest.fn().mockResolvedValue(undefined),
  };
  const deviceService = { markSeen: jest.fn(), updateDeviceInfo: jest.fn() };
  const dashboardService = {
    getDeviceDashboardPayload: jest.fn().mockResolvedValue({}),
  };
  const idempotency = {
    claim: overrides.claim ?? jest.fn().mockResolvedValue(true),
    release: overrides.release ?? jest.fn().mockResolvedValue(undefined),
  };
  const agentService = {
    exchange: jest.fn(),
    verifyAccess: jest.fn(),
    revoke: jest.fn(),
  };

  const controller = new TelemetryController(
    realtime as any,
    metricsQueue as any,
    deviceService as any,
    dashboardService as any,
    idempotency as any,
    agentService as any,
  );
  return { controller, realtime, metricsQueue, deviceService, idempotency };
}

const metadata = { agent: { deviceId: 'dev-1' } };
const batch = {
  batchId: 'b1',
  sentAtUnixMs: 1,
  intervalSec: 5,
  metrics: [{ name: 'cpu.percent', value: 10, labels: {}, tsUnixMs: 1 }],
  systemInfo: { hostname: 'h1' },
};

describe('TelemetryController.ingestBatch', () => {
  it('returns UNAUTHENTICATED when the guard did not attach a deviceId', async () => {
    const { controller } = makeController({});
    const ack = await controller.ingestBatch(batch, {});
    expect(ack.status).toBe(IngestStatus.UNAUTHENTICATED);
    expect(ack.ok).toBe(false);
  });

  it('returns ACCEPTED after persistence and emits realtime', async () => {
    const { controller, realtime, metricsQueue } = makeController({});
    const ack = await controller.ingestBatch(batch, metadata);
    expect(ack.status).toBe(IngestStatus.ACCEPTED);
    expect(ack.ok).toBe(true);
    expect(realtime.emitToDevice).toHaveBeenCalledWith(
      'dev-1',
      'telemetry',
      expect.any(Object),
    );
    expect(metricsQueue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('returns DUPLICATE and skips persistence for a replayed batch', async () => {
    const claim = jest.fn().mockResolvedValue(false);
    const { controller, realtime, metricsQueue } = makeController({ claim });
    const ack = await controller.ingestBatch(batch, metadata);
    expect(ack.status).toBe(IngestStatus.DUPLICATE);
    expect(ack.ok).toBe(true);
    expect(realtime.emitToDevice).not.toHaveBeenCalled();
    expect(metricsQueue.enqueue).not.toHaveBeenCalled();
  });

  it('returns RETRY and releases the claim when persistence fails', async () => {
    const release = jest.fn().mockResolvedValue(undefined);
    const enqueue = jest.fn().mockRejectedValue(new Error('db down'));
    const { controller } = makeController({ release, enqueue });
    const ack = await controller.ingestBatch(batch, metadata);
    expect(ack.status).toBe(IngestStatus.RETRY);
    expect(ack.ok).toBe(false);
    expect(release).toHaveBeenCalledWith('b1');
  });
});
