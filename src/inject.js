/**
 * MAIN-World-Override. Laeuft bei document_start, bevor Seitenskripte
 * navigator.geolocation anfassen koennen. Konfiguration kommt per postMessage
 * aus dem isolierten Bridge-Script (siehe src/bridge.js) und landet ueber
 * chrome.storage.onChanged auch in bereits geoeffneten Tabs.
 */
(function () {
  'use strict';

  var positionFactory = globalThis.FLCPosition;
  var validator = globalThis.FLCValidate;

  if (!positionFactory || !validator || globalThis.__flcInstalled) {
    return;
  }
  globalThis.__flcInstalled = true;

  var nativeGeo = navigator.geolocation;
  // Eigene Properties auf dem Geolocation-Objekt verdecken die Prototyp-Methoden,
  // deshalb die Originale vorher binden.
  var nativeGetCurrentPosition = nativeGeo.getCurrentPosition.bind(nativeGeo);
  var nativeWatchPosition = nativeGeo.watchPosition.bind(nativeGeo);
  var nativeClearWatch = nativeGeo.clearWatch.bind(nativeGeo);
  var MESSAGE_TAG = '__flcSettings';
  var REQUEST_TAG = '__flcRequest';
  var WATCH_REFRESH_MS = 10000;
  var firstOwnWatchId = 1 << 20;

  var state = {
    ready: false,
    enabled: false,
    settings: validator.defaults()
  };

  var nextWatchId = firstOwnWatchId;
  // eigene Watch-Id -> { success, error, options, nativeId, timer }
  var watches = new Map();

  function callAsync(fn) {
    if (typeof fn !== 'function') {
      return;
    }
    setTimeout(function () {
      fn();
    }, 0);
  }

  function reportToErrorCallback(record) {
    callAsync(function () {
      if (typeof record.error === 'function') {
        record.error(new Error('Fake Location: Positionserzeugung fehlgeschlagen.'));
      }
    });
  }

  function emitPosition(record) {
    try {
      var position = positionFactory.createPosition(state.settings);
      record.success(position);
    } catch (err) {
      reportToErrorCallback(record);
    }
  }

  function stopNativeWatch(record) {
    if (record.nativeId !== null) {
      try {
        nativeClearWatch(record.nativeId);
      } catch (err) {
        // nativer Watch war bereits beendet
      }
      record.nativeId = null;
    }
  }

  function stopTimer(record) {
    if (record.timer !== null) {
      clearInterval(record.timer);
      record.timer = null;
    }
  }

  function watchInNativeMode(record) {
    stopTimer(record);
    if (record.nativeId !== null) {
      return;
    }
    record.nativeId = nativeWatchPosition(record.success, record.error, record.options);
  }

  function watchInSpoofMode(record) {
    stopNativeWatch(record);
    emitPosition(record);
    stopTimer(record);
    record.timer = setInterval(function () {
      emitPosition(record);
    }, WATCH_REFRESH_MS);
  }

  function syncWatch(record) {
    if (state.ready && state.enabled) {
      watchInSpoofMode(record);
    } else {
      watchInNativeMode(record);
    }
  }

  function getCurrentPosition(success, error, options) {
    if (!state.ready || !state.enabled) {
      return nativeGetCurrentPosition(success, error, options);
    }
    var record = { success: success, error: error, options: options, nativeId: null, timer: null };
    callAsync(function () {
      emitPosition(record);
    });
    return undefined;
  }

  function watchPosition(success, error, options) {
    if (typeof success !== 'function') {
      return nativeWatchPosition(success, error, options);
    }
    var id = nextWatchId;
    nextWatchId += 1;
    var record = { success: success, error: error, options: options, nativeId: null, timer: null };
    watches.set(id, record);
    syncWatch(record);
    return id;
  }

  function clearWatch(id) {
    var record = watches.get(id);
    if (!record) {
      return nativeClearWatch(id);
    }
    stopTimer(record);
    stopNativeWatch(record);
    watches.delete(id);
    return undefined;
  }

  function applySettings(candidate) {
    var normalized = validator.normalizeSettings(candidate);
    var wasSpoofing = state.ready && state.enabled;
    state.settings = normalized.settings;
    state.enabled = normalized.ok && normalized.settings.enabled !== false;
    state.ready = true;

    var isSpoofing = state.enabled;
    if (wasSpoofing === isSpoofing && !isSpoofing) {
      return;
    }
    watches.forEach(function (record) {
      syncWatch(record);
    });
  }

  function defineMethod(name, value) {
    Object.defineProperty(nativeGeo, name, {
      value: value,
      configurable: true,
      writable: true
    });
  }

  defineMethod('getCurrentPosition', getCurrentPosition);
  defineMethod('watchPosition', watchPosition);
  defineMethod('clearWatch', clearWatch);

  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || typeof event.data !== 'object') {
      return;
    }
    if (event.data[MESSAGE_TAG] === true) {
      applySettings(event.data.settings);
    }
  });

  // Bridge und MAIN-Script koennen in beliebiger Reihenfolge starten: so lange
  // keine Antwort da ist, wird die Konfiguration erneut angefordert.
  var attempts = 0;
  var MAX_ATTEMPTS = 40;
  var RETRY_MS = 50;

  function requestSettings() {
    if (state.ready || attempts >= MAX_ATTEMPTS) {
      return;
    }
    attempts += 1;
    window.postMessage({ [REQUEST_TAG]: true }, '*');
    setTimeout(requestSettings, RETRY_MS);
  }

  requestSettings();

  // Die eigene Kennung sichtbar machen, damit Smoke-Tests pruefen koennen,
  // ob der Override wirklich vor den Seitenskripten aktiv war.
  globalThis.__flcState = state;
})();
