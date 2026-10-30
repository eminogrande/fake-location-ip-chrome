/**
 * Popup-Steuerung: laden, validieren, speichern. Gespeichert wird nur ein
 * vollstaendig gueltiger Datensatz, damit Tabs nie mit NaN arbeiten.
 */
(function () {
  'use strict';

  var validator = globalThis.FLCValidate;
  var SETTINGS_KEY = 'settings';
  var FIELDS = ['latitude', 'longitude', 'accuracy'];

  var form = document.getElementById('settings');
  var enabledInput = document.getElementById('enabled');
  var fieldsBox = document.getElementById('fields');
  var statusEl = document.getElementById('status');
  var resetButton = document.getElementById('reset');
  var useCurrentButton = document.getElementById('use-current');

  var inputs = {
    latitude: document.getElementById('latitude'),
    longitude: document.getElementById('longitude'),
    accuracy: document.getElementById('accuracy')
  };
  var errorEls = {
    latitude: document.getElementById('latitude-error'),
    longitude: document.getElementById('longitude-error'),
    accuracy: document.getElementById('accuracy-error')
  };

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function clearFieldErrors() {
    FIELDS.forEach(function (field) {
      errorEls[field].textContent = '';
      inputs[field].removeAttribute('aria-invalid');
    });
  }

  function showFieldErrors(errors) {
    FIELDS.forEach(function (field) {
      var message = errors[field];
      errorEls[field].textContent = message || '';
      if (message) {
        inputs[field].setAttribute('aria-invalid', 'true');
      } else {
        inputs[field].removeAttribute('aria-invalid');
      }
    });
  }

  function fill(settings) {
    enabledInput.checked = settings.enabled !== false;
    inputs.latitude.value = String(settings.latitude);
    inputs.longitude.value = String(settings.longitude);
    inputs.accuracy.value = String(settings.accuracy);
    syncFieldsetState();
  }

  function readForm() {
    return {
      enabled: enabledInput.checked,
      latitude: inputs.latitude.value,
      longitude: inputs.longitude.value,
      accuracy: inputs.accuracy.value
    };
  }

  function syncFieldsetState() {
    fieldsBox.disabled = !enabledInput.checked;
  }

  function save(settings) {
    var payload = {};
    payload[SETTINGS_KEY] = settings;
    chrome.storage.local.set(payload, function () {
      if (chrome.runtime.lastError) {
        setStatus('Speichern fehlgeschlagen: ' + chrome.runtime.lastError.message, 'bad');
        return;
      }
      setStatus('Gespeichert.', 'ok');
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearFieldErrors();
    var normalized = validator.normalizeSettings(readForm());
    if (!normalized.ok) {
      showFieldErrors(normalized.errors);
      setStatus('Bitte die markierten Felder korrigieren.', 'bad');
      return;
    }
    save(normalized.settings);
  });

  enabledInput.addEventListener('change', syncFieldsetState);

  resetButton.addEventListener('click', function () {
    clearFieldErrors();
    var defaults = validator.defaults();
    fill(defaults);
    save(defaults);
    setStatus('Standardwerte wiederhergestellt.', 'ok');
  });

  useCurrentButton.addEventListener('click', function () {
    setStatus('Frage echten Standort ab …');
    navigator.geolocation.getCurrentPosition(
      function (position) {
        inputs.latitude.value = String(Number(position.coords.latitude.toFixed(6)));
        inputs.longitude.value = String(Number(position.coords.longitude.toFixed(6)));
        if (Number.isFinite(position.coords.accuracy)) {
          inputs.accuracy.value = String(Math.round(position.coords.accuracy));
        }
        setStatus('Echten Standort übernommen – noch speichern.', 'ok');
      },
      function () {
        setStatus('Echter Standort nicht verfügbar (Berechtigung?).', 'bad');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });

  chrome.storage.local.get(SETTINGS_KEY, function (items) {
    var stored = items && items[SETTINGS_KEY];
    if (stored) {
      fill(validator.normalizeSettings(stored).settings);
    } else {
      fill(validator.defaults());
    }
  });
})();
