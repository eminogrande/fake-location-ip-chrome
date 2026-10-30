import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/lib/position.js';

const { createPosition } = globalThis.FLCPosition;
const settings = { latitude: 48.137154, longitude: 11.576124, accuracy: 30 };

test('Position spiegelt die konfigurierten Werte', () => {
  const position = createPosition(settings, 1700000000000);
  assert.equal(position.coords.latitude, 48.137154);
  assert.equal(position.coords.longitude, 11.576124);
  assert.equal(position.coords.accuracy, 30);
  assert.equal(position.timestamp, 1700000000000);
});

test('Nicht gesetzte Koordinatenfelder sind null wie im Original', () => {
  const { coords } = createPosition(settings, 1);
  assert.equal(coords.altitude, null);
  assert.equal(coords.altitudeAccuracy, null);
  assert.equal(coords.heading, null);
  assert.equal(coords.speed, null);
});

test('toJSON liefert eine serialisierbare Struktur', () => {
  const json = createPosition(settings, 123).toJSON();
  assert.deepEqual(Object.keys(json).sort(), ['coords', 'timestamp']);
  assert.equal(json.coords.latitude, 48.137154);
  assert.equal(json.timestamp, 123);
});

test('ohne now wird die aktuelle Zeit genutzt', () => {
  const before = Date.now();
  const { timestamp } = createPosition(settings);
  assert.equal(Number.isFinite(timestamp), true);
  assert.ok(timestamp >= before);
});
