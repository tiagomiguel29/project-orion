import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTelemetry, bucketSize, compactSeries, RANGE_POINTS, timestamp } from '../apps/web/lib/live-series.ts';
import { generateTicks, getRangeDomain, mapDeviceToChartData, shouldShowDots } from '../apps/web/lib/device-mapper.ts';

const now = 1_800_000_000_000;
const durations = { '1m':60000, '5m':300000, '1h':3600000, '2h':7200000, '5h':18000000,
  '12h':43200000, '1d':86400000, '1w':604800000, '1mo':2592000000, '1y':31536000000, all:315360000000 };
for (const range of Object.keys(RANGE_POINTS)) {
  test(`${range}: dense history and prolonged live sessions stay bounded and sorted`, () => {
    const span = durations[range];
    let points = compactSeries(Array.from({length:5000}, (_, i) => ({
      tsUnixMs: now - span + Math.floor(i * span / 5000), value: i % 100,
    })), range, now);
    for (let i = 1; i <= 1000; i++) {
      points = compactSeries([...points, {tsUnixMs:now + i * 1000, value:50}], range, now + i * 1000);
    }
    assert(points.filter(p => p.value !== null).length <= RANGE_POINTS[range] + 1);
    assert(points.length <= 2 * (RANGE_POINTS[range] + 1) - 1);
    assert(points.every((p, i) => i === 0 || p.tsUnixMs > points[i - 1].tsUnixMs));
    if (range === 'all') assert(points[0].tsUnixMs < now - span / 2, 'all-time must retain older history');
  });
}

test('averages remain weighted across REST buckets and live samples', () => {
  const ts = Math.floor(now / 5000) * 5000;
  const points = compactSeries([{tsUnixMs:ts, value:10, sampleCount:3}, {tsUnixMs:ts+1000, value:50}], '1m', now + 2000);
  assert.equal(points[0].value, 20);
  assert.equal(points[0].sampleCount, 4);
});

test('source timestamps, duplicate suppression, disk mount and temperature max', () => {
  const device = { externalId:'dev', os:'linux', sparklines:['cpuPct', 'diskPct', 'cpuTempC'].map(name => ({name, unit:'', points:[]})) };
  const event = { deviceId:'dev', sentAtUnixMs:String(now-10000), metrics:[
    {name:'cpu.percent', value:20, tsUnixMs:String(now-10000)},
    {name:'disk.used_percent', value:30, tsUnixMs:String(now-10000), labels:{mount:'/'}},
    {name:'disk.used_percent', value:99, tsUnixMs:String(now-10000), labels:{mount:'/data'}},
    {name:'sensor.temperature_celsius', value:50, tsUnixMs:String(now-10000)},
    {name:'sensor.temperature_celsius', value:60, tsUnixMs:String(now-10000)},
  ] };
  const first = applyTelemetry(device, event, '1m', now);
  const second = applyTelemetry(first, event, '1m', now);
  assert.deepEqual(second, first);
  assert.equal(first.sparklines[0].points[0].lastTsUnixMs, now-10000);
  assert.equal(first.sparklines[1].points[0].value, 30);
  assert.equal(first.sparklines[2].points[0].value, 60);
  assert.equal(timestamp({low:now|0, high:Math.floor(now/4294967296)}), now);
});

test('offline gaps remain ordered and bounded rather than connecting outages', () => {
  const result = compactSeries([{tsUnixMs:now-50000, value:10}, {tsUnixMs:now-1000, value:20}], '1m', now);
  assert.equal(result[1].value, null);
  assert(result[0].tsUnixMs < result[1].tsUnixMs && result[1].tsUnixMs < result[2].tsUnixMs);
});

test('all-time domains and ticks work with a single point and with decades of data', () => {
  const domain = getRangeDomain('all', [{ts:now}], now);
  assert(domain[0] < domain[1]);
  for (const data of [[{ts:now}], [{ts:now-20*365*86400000}, {ts:now}]]) {
    const ticks = generateTicks('all', data, now);
    assert(ticks.length >= 2 && ticks.length <= 9);
  }
});

test('missing network direction is not drawn as a fake zero', () => {
  const card = {status:'offline', sparklines:[{name:'netIn',points:[{tsUnixMs:now,value:1000}]}]};
  assert.equal(mapDeviceToChartData(card,'1h',now).network[0].upload, null);
});

test('single and isolated gap-separated samples remain visible', () => {
  assert.equal(shouldShowDots([{value:42}]), true);
  assert.equal(shouldShowDots([{value:42},{value:null},{value:43}]), true);
  assert.equal(shouldShowDots([{value:42},{value:43}]), false);
});
