/**
 * Faehrt src/inject.js in einem vm-Kontext mit gefakten Browser-APIs, um das
 * echte Override-Verhalten zu pruefen: Delegation solange deaktiviert,
 * konfigurierte Position bei Aktivierung, Umschalten laufender Watches.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const SOURCES = ['src/lib/validate.js', 'src/lib/position.js', 'src/inject.js'].map((file) =>
  readFileSync(new URL('../' + file, import.meta.url), 'utf8')
);

function createHarness() {
  const native = {
    getCalls: 0,
    nativeWatches: 0,
    cleared: [],
    getCurrentPosition() {
      native.getCalls += 1;
    },
    watchPosition() {
      native.nativeWatches += 1;
      return native.nativeWatches;
    },
    clearWatch(id) {
      native.cleared.push(id);
    }
  };

  const listeners = [];
  const timeouts = [];
  const intervals = new Map();
  let intervalId = 0;

  const window = {
    addEventListener(type, fn) {
      if (type === 'message') listeners.push(fn);
    },
    postMessage(data) {
      for (const fn of listeners) fn({ source: window, data });
    }
  };

  const context = vm.createContext({
    window,
    navigator: { geolocation: native },
    setTimeout(fn) {
      timeouts.push(fn);
      return timeouts.length;
    },
    setInterval(fn) {
      intervalId += 1;
      intervals.set(intervalId, fn);
      return intervalId;
    },
    clearInterval(id) {
      intervals.delete(id);
    }
  });

  for (const code of SOURCES) {
    vm.runInContext(code, context, { filename: 'inject-harness.js' });
  }

  return {
    native,
    geo: native,
    flush() {
      while (timeouts.length > 0) timeouts.shift()();
    },
    tickIntervals() {
      for (const fn of intervals.values()) fn();
    },
    intervalCount() {
      return intervals.size;
    },
    configure(settings) {
      window.postMessage({ __flcSettings: true, settings });
    }
  };
}

function collect() {
  const calls = { positions: [], errors: 0 };
  return {
    calls,
    success(position) {
      calls.positions.push(position);
    },
    error() {
      calls.errors += 1;
    }
  };
}

const berlin = { enabled: true, latitude: 52.52, longitude: 13.405, accuracy: 50 };

test('ohne Konfiguration wird an die native API delegiert', () => {
  const harness = createHarness();
  const sink = collect();

  harness.geo.getCurrentPosition(sink.success, sink.error, { timeout: 1 });
  harness.flush();

  assert.equal(harness.native.getCalls, 1);
  assert.equal(sink.calls.positions.length, 0);
});

test('aktiv liefert die konfigurierte Position statt der nativen', () => {
  const harness = createHarness();
  const sink = collect();
  harness.configure(berlin);

  harness.geo.getCurrentPosition(sink.success, sink.error, {});
  harness.flush();

  assert.equal(harness.native.getCalls, 0);
  assert.equal(sink.calls.positions.length, 1);
  const { coords, timestamp } = sink.calls.positions[0];
  assert.equal(coords.latitude, 52.52);
  assert.equal(coords.longitude, 13.405);
  assert.equal(coords.accuracy, 50);
  assert.equal(typeof timestamp, 'number');
});

test('ungueltige Konfiguration faellt auf die native API zurueck', () => {
  const harness = createHarness();
  const sink = collect();
  harness.configure({ enabled: true, latitude: 300, longitude: 13.405, accuracy: 50 });

  harness.geo.getCurrentPosition(sink.success, sink.error, {});
  harness.flush();

  assert.equal(harness.native.getCalls, 1);
  assert.equal(sink.calls.positions.length, 0);
});

test('watchPosition liefert eigene IDs und wiederholt Positionen', () => {
  const harness = createHarness();
  const sink = collect();
  harness.configure(berlin);

  const id = harness.geo.watchPosition(sink.success, sink.error, {});
  harness.flush();

  assert.ok(id >= 1 << 20, 'eigene Watch-Id liegt ausserhalb des nativen Bereichs');
  assert.equal(harness.native.nativeWatches, 0);
  assert.equal(sink.calls.positions.length, 1);
  assert.equal(harness.intervalCount(), 1);

  harness.tickIntervals();
  assert.equal(sink.calls.positions.length, 2);

  harness.geo.clearWatch(id);
  assert.equal(harness.intervalCount(), 0);
  assert.deepEqual(harness.native.cleared, []);
});

test('Deaktivieren beendet den Spoof-Watch und startet einen nativen Watch', () => {
  const harness = createHarness();
  const sink = collect();
  harness.configure(berlin);

  const id = harness.geo.watchPosition(sink.success, sink.error, {});
  harness.flush();
  assert.equal(harness.native.nativeWatches, 0);

  harness.configure({ ...berlin, enabled: false });
  harness.flush();

  assert.equal(harness.native.nativeWatches, 1);
  assert.equal(harness.intervalCount(), 0);

  harness.geo.clearWatch(id);
  assert.deepEqual(harness.native.cleared, [1]);
});

test('Aktivieren uebernimmt bereits laufende native Watches', () => {
  const harness = createHarness();
  const sink = collect();

  const id = harness.geo.watchPosition(sink.success, sink.error, {});
  assert.equal(harness.native.nativeWatches, 1);

  harness.configure(berlin);
  harness.flush();

  assert.deepEqual(harness.native.cleared, [1]);
  assert.equal(sink.calls.positions.length, 1);
  assert.equal(sink.calls.positions[0].coords.latitude, 52.52);

  harness.geo.clearWatch(id);
  assert.equal(harness.intervalCount(), 0);
});

test('Koordinatenaenderung aktualisiert einen laufenden Spoof-Watch', () => {
  const harness = createHarness();
  const sink = collect();
  harness.configure(berlin);

  harness.geo.watchPosition(sink.success, sink.error, {});
  harness.flush();

  harness.configure({ ...berlin, latitude: 48.137154, longitude: 11.576124 });
  harness.flush();

  assert.equal(sink.calls.positions.at(-1).coords.latitude, 48.137154);
  assert.equal(sink.calls.positions.at(-1).coords.longitude, 11.576124);
});

test('clearWatch mit unbekannter ID geht an die native API', () => {
  const harness = createHarness();
  harness.geo.clearWatch(7);
  assert.deepEqual(harness.native.cleared, [7]);
});
