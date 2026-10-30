/**
 * Prueft das isolierte Bridge-Script gegen gefakte chrome.storage-APIs:
 * es darf nur rohe Werte weiterreichen, nie selbst validieren oder werfen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../src/bridge.js', import.meta.url), 'utf8');

function createHarness(storage = {}) {
  const posted = [];
  const listeners = [];
  const changedListeners = [];
  let lastError = null;

  const window = {
    addEventListener(type, fn) {
      if (type === 'message') listeners.push(fn);
    },
    postMessage(data) {
      posted.push(data);
    }
  };

  const chrome = {
    runtime: {
      get lastError() {
        return lastError;
      }
    },
    storage: {
      local: {
        get(key, cb) {
          const value = storage[key];
          setTimeout(() => cb(value === undefined ? {} : { [key]: value }), 0);
        }
      },
      onChanged: {
        addListener(fn) {
          changedListeners.push(fn);
        }
      }
    }
  };

  const context = vm.createContext({ window, chrome, setTimeout, clearTimeout });
  vm.runInContext(SOURCE, context, { filename: 'bridge.js' });

  return {
    posted,
    runAgain() {
      vm.runInContext(SOURCE, context, { filename: 'bridge-again.js' });
    },
    setLastError(value) {
      lastError = value;
    },
    emitChange(newValue, area = 'local') {
      for (const fn of changedListeners) fn({ settings: { newValue } }, area);
    },
    request() {
      for (const fn of listeners) fn({ source: window, data: { __flcRequest: true } });
    },
    otherWindow() {
      for (const fn of listeners) fn({ source: {}, data: { __flcRequest: true } });
    }
  };
}

const settings = { enabled: true, latitude: 1, longitude: 2, accuracy: 3 };

test('sendet gespeicherte Einstellungen an die Seite', async () => {
  const harness = createHarness({ settings });
  await new Promise((r) => setTimeout(r, 5));
  const messages = harness.posted.filter((m) => m.__flcSettings);
  assert.equal(messages.length >= 1, true);
  assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1).settings)), settings);
});

test('sendet ein leeres Objekt, wenn nichts gespeichert ist', async () => {
  const harness = createHarness({});
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(Object.keys(harness.posted.at(-1).settings).length, 0);
});

test('reicht storage.onChanged aus dem local-Bereich weiter', async () => {
  const harness = createHarness({ settings });
  await new Promise((r) => setTimeout(r, 5));
  const before = harness.posted.length;

  harness.emitChange({ ...settings, latitude: 48.1 });
  assert.equal(harness.posted.length, before + 1);
  assert.equal(harness.posted.at(-1).settings.latitude, 48.1);

  harness.emitChange({ ...settings, latitude: 11 }, 'sync');
  assert.equal(harness.posted.length, before + 1);
});

test('reagiert auf Anfragen nur aus dem eigenen Fenster', async () => {
  const harness = createHarness({ settings });
  await new Promise((r) => setTimeout(r, 5));
  const before = harness.posted.length;

  harness.otherWindow();
  assert.equal(harness.posted.length, before);

  harness.request();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(harness.posted.length, before + 1);
});

test('lastError fuehrt zu leerem Payload statt Ausnahme', async () => {
  const harness = createHarness({ settings });
  harness.setLastError({ message: 'kaputt' });
  harness.request();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(Object.keys(harness.posted.at(-1).settings).length, 0);
});

test('installiert sich nur einmal pro Dokument', async () => {
  const harness = createHarness({ settings });
  await new Promise((r) => setTimeout(r, 5));
  const count = harness.posted.length;

  harness.runAgain();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(harness.posted.length, count);
});
