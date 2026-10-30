/**
 * Reine Validierungslogik. Keine chrome- oder DOM-Abhaengigkeiten, damit sie in
 * Node getestet werden kann. Wird als klassisches Skript in Popup und
 * Content-Script geladen und haengt sich an globalThis.FLCValidate.
 */
(function (root) {
  'use strict';

  var DEFAULTS = Object.freeze({
    enabled: true,
    latitude: 52.52,
    longitude: 13.405,
    accuracy: 50
  });

  var FIELDS = ['latitude', 'longitude', 'accuracy'];

  function parseNumber(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : NaN;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return Number(value.trim());
    }
    return NaN;
  }

  function checkNumber(value, min, max, missingMessage, rangeMessage) {
    var n = parseNumber(value);
    if (Number.isNaN(n)) {
      return { ok: false, value: null, error: missingMessage };
    }
    if (n < min || n > max) {
      return { ok: false, value: null, error: rangeMessage };
    }
    return { ok: true, value: n, error: null };
  }

  function validateLatitude(value) {
    return checkNumber(
      value,
      -90,
      90,
      'Breitengrad muss eine Zahl sein.',
      'Breitengrad muss zwischen -90 und 90 liegen.'
    );
  }

  function validateLongitude(value) {
    return checkNumber(
      value,
      -180,
      180,
      'Längengrad muss eine Zahl sein.',
      'Längengrad muss zwischen -180 und 180 liegen.'
    );
  }

  function validateAccuracy(value) {
    var result = checkNumber(
      value,
      0,
      Number.MAX_VALUE,
      'Genauigkeit muss eine Zahl sein.',
      'Genauigkeit darf nicht negativ sein.'
    );
    if (!result.ok) {
      return result;
    }
    if (!Number.isFinite(result.value)) {
      return { ok: false, value: null, error: 'Genauigkeit muss eine endliche Zahl sein.' };
    }
    return result;
  }

  function defaults() {
    return {
      enabled: DEFAULTS.enabled,
      latitude: DEFAULTS.latitude,
      longitude: DEFAULTS.longitude,
      accuracy: DEFAULTS.accuracy
    };
  }

  /**
   * Prueft ein beliebiges gespeichertes oder vom Popup geliefertes Objekt.
   * Liefert immer { ok, settings, errors }. Ungueltige Felder werden auf
   * Defaults zurueckgesetzt, damit die Injektion nie mit NaN arbeitet.
   */
  function normalizeSettings(raw) {
    var input = raw && typeof raw === 'object' ? raw : {};
    var errors = {};
    var settings = defaults();
    var validators = {
      latitude: validateLatitude,
      longitude: validateLongitude,
      accuracy: validateAccuracy
    };

    for (var i = 0; i < FIELDS.length; i += 1) {
      var field = FIELDS[i];
      var present = Object.prototype.hasOwnProperty.call(input, field);
      if (!present) {
        continue;
      }
      var result = validators[field](input[field]);
      if (result.ok) {
        settings[field] = result.value;
      } else {
        errors[field] = result.error;
      }
    }

    settings.enabled = input.enabled !== false;
    return {
      ok: Object.keys(errors).length === 0,
      settings: settings,
      errors: errors
    };
  }

  function sameSettings(a, b) {
    return (
      a.enabled === b.enabled &&
      a.latitude === b.latitude &&
      a.longitude === b.longitude &&
      a.accuracy === b.accuracy
    );
  }

  root.FLCValidate = {
    DEFAULTS: DEFAULTS,
    defaults: defaults,
    normalizeSettings: normalizeSettings,
    validateLatitude: validateLatitude,
    validateLongitude: validateLongitude,
    validateAccuracy: validateAccuracy,
    sameSettings: sameSettings
  };
})(globalThis);
