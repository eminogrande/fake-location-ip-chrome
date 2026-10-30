/**
 * Isoliertes Content-Script: liest die Einstellungen aus chrome.storage.local
 * und reicht sie roh an das MAIN-World-Script weiter. Validierung und Defaults
 * liegen dort (src/lib/validate.js) – das isolierte Script braucht sie nicht.
 */
(function () {
  'use strict';

  if (globalThis.__flcBridgeInstalled) {
    return;
  }
  globalThis.__flcBridgeInstalled = true;

  var SETTINGS_KEY = 'settings';
  var MESSAGE_TAG = '__flcSettings';
  var REQUEST_TAG = '__flcRequest';

  function publish(settings) {
    window.postMessage({ [MESSAGE_TAG]: true, settings: settings || {} }, '*');
  }

  function load() {
    chrome.storage.local.get(SETTINGS_KEY, function (items) {
      publish(!chrome.runtime.lastError && items ? items[SETTINGS_KEY] : null);
    });
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || typeof event.data !== 'object') {
      return;
    }
    if (event.data[REQUEST_TAG] === true) {
      load();
    }
  });

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'local' || !changes[SETTINGS_KEY]) {
      return;
    }
    publish(changes[SETTINGS_KEY].newValue);
  });

  load();
})();
