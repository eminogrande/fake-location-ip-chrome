# fake-location-ip-chrome

Chrome-/Brave-Erweiterung (MV3), die `navigator.geolocation` in jeder Seite mit
einem eigenen Standort überschreibt. Kein Build, keine Abhängigkeiten, keine
Netzwerkaufrufe – die Einstellungen liegen ausschließlich in
`chrome.storage.local`.

## Installieren

1. `chrome://extensions` (oder `brave://extensions`) öffnen, Entwicklermodus
   einschalten.
2. „Entpackte Erweiterung laden“ und diesen Ordner wählen.
3. In bereits geöffneten Tabs einmal neu laden, damit das Content-Script greift.

## Bedienung

Popup-Symbol anklicken:

- **Fake-Standort aktiv** – Schalter. Aus = alle Anfragen gehen unverändert an
  den echten Standort (inklusive Berechtigungsdialog).
- **Breitengrad** −90…90, **Längengrad** −180…180, **Genauigkeit** in Metern
  (≥ 0, endlich). Ungültige Eingaben werden am Feld markiert und nicht
  gespeichert.
- **Echten Standort übernehmen** füllt die Felder mit der aktuellen Position.
- **Speichern** schreibt die Werte; offene Tabs übernehmen sie sofort über
  `chrome.storage.onChanged`.

`getCurrentPosition`, `watchPosition` und `clearWatch` funktionieren auch im
Fake-Modus; Watches liefern die Position sofort und danach alle 10 s.

## Testen

Unit-Tests (reine Validierungs- und Positionslogik sowie der echte Override in
einem `vm`-Kontext mit gefakten Browser-APIs):

```sh
npm test          # node --test test/
```

Manueller Browser-Smoke-Test: `test/smoke.html` über einen lokalen Server
öffnen (z. B. `npx serve .`), bei geladener Erweiterung müssen die Buttons den
konfigurierten Standort ausgeben. `file://` braucht zusätzlich „Zugriff auf
Datei-URLs zulassen“ in den Erweiterungsdetails.

`test/e2e.html` macht dasselbe ohne Klicks und schreibt das Ergebnis in
`data-*`-Attribute am `<body>` (`data-early`, `data-lat`, `data-hits-after-clear`),
damit sich ein Lauf über CDP automatisieren lässt.

## Grenzen

- Nur `navigator.geolocation`; IP/Netzwerk-Standort bleibt echt.
- `navigator.permissions.query({name: 'geolocation'})` meldet weiterhin den
  echten Berechtigungsstatus.
- Kein Netzwerkzugriff, keine Host-Berechtigungen, nur `storage` und
  `geolocation`.
- Standardwerte nach der Installation: aktiv, Berlin (52.52 / 13.405), 50 m.
