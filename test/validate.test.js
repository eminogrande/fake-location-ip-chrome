import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/lib/validate.js';

const { normalizeSettings, defaults, validateLatitude, validateLongitude, validateAccuracy } =
  globalThis.FLCValidate;

test('Grenzwerte fuer Breitengrad', () => {
  assert.equal(validateLatitude(-90).ok, true);
  assert.equal(validateLatitude(90).ok, true);
  assert.equal(validateLatitude(90.0001).ok, false);
  assert.equal(validateLatitude(-90.0001).ok, false);
  assert.equal(validateLatitude('52.52').value, 52.52);
  assert.equal(validateLatitude('').ok, false);
  assert.equal(validateLatitude('abc').ok, false);
  assert.equal(validateLatitude(NaN).ok, false);
});

test('Grenzwerte fuer Laengengrad', () => {
  assert.equal(validateLongitude(-180).ok, true);
  assert.equal(validateLongitude(180).ok, true);
  assert.equal(validateLongitude(180.5).ok, false);
  assert.equal(validateLongitude(-180.5).ok, false);
  assert.equal(validateLongitude(' 13.405 ').value, 13.405);
  assert.equal(validateLongitude(null).ok, false);
});

test('Genauigkeit muss endlich und nicht negativ sein', () => {
  assert.equal(validateAccuracy(0).ok, true);
  assert.equal(validateAccuracy('25').value, 25);
  assert.equal(validateAccuracy(-1).ok, false);
  assert.equal(validateAccuracy(Infinity).ok, false);
  assert.equal(validateAccuracy('').ok, false);
});

test('normalizeSettings liefert Defaults statt NaN', () => {
  const result = normalizeSettings({ latitude: 'x', longitude: 500, accuracy: null });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['accuracy', 'latitude', 'longitude']);
  assert.equal(Number.isFinite(result.settings.latitude), true);
  assert.equal(Number.isFinite(result.settings.longitude), true);
  assert.equal(Number.isFinite(result.settings.accuracy), true);
  assert.deepEqual(result.settings, { ...defaults(), enabled: true });
});

test('normalizeSettings behaelt gueltige Werte und enabled', () => {
  const result = normalizeSettings({
    enabled: false,
    latitude: -33.8688,
    longitude: 151.2093,
    accuracy: 12
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.settings, {
    enabled: false,
    latitude: -33.8688,
    longitude: 151.2093,
    accuracy: 12
  });
});

test('normalizeSettings vertraegt Muell', () => {
  for (const garbage of [null, undefined, 42, 'text', []]) {
    const result = normalizeSettings(garbage);
    assert.equal(result.ok, true);
    assert.deepEqual(result.settings, { ...defaults(), enabled: true });
  }
  assert.equal(normalizeSettings({ enabled: 0 }).settings.enabled, true);
  assert.equal(normalizeSettings({ enabled: false }).settings.enabled, false);
});
