/**
 * Baut ein GeolocationPosition-foermiges Objekt. Reine Funktionen, kein DOM,
 * damit dieselbe Logik im MAIN-World-Script und in Node-Tests laeuft.
 */
(function (root) {
  'use strict';

  function createCoordinates(settings) {
    var coords = {
      latitude: settings.latitude,
      longitude: settings.longitude,
      accuracy: settings.accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    };
    coords.toJSON = function toJSON() {
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude,
        altitudeAccuracy: coords.altitudeAccuracy,
        heading: coords.heading,
        speed: coords.speed
      };
    };
    return coords;
  }

  function createPosition(settings, now) {
    var timestamp = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
    var position = {
      coords: createCoordinates(settings),
      timestamp: timestamp
    };
    position.toJSON = function toJSON() {
      return { coords: position.coords.toJSON(), timestamp: position.timestamp };
    };
    return position;
  }

  root.FLCPosition = { createPosition: createPosition };
})(globalThis);
