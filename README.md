# Kostentracker

Lokaler Kosten-Tracker für Haushaltsausgaben mit integrierter Einkaufsliste.
Progressive Web App, ein Nutzer, ein Gerät. Alle Daten liegen in IndexedDB auf
dem Gerät — kein Backend, kein Konto, keine Netzwerkzugriffe zur Laufzeit.

Verbindlich ist [SPEC.md](SPEC.md).

## Setup

```bash
npm install
npm run dev
```

Die App läuft dann auf <http://localhost:5173>.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Hot Reload |
| `npm run build` | Typprüfung und Produktions-Build nach `dist/` |
| `npm run preview` | `dist/` lokal ausliefern (<http://localhost:4173>) |
| `npm test` | Unit-Tests einmalig |
| `npm run test:watch` | Unit-Tests im Watch-Modus |
| `npm run typecheck` | Nur die Typprüfung |
| `npm run icons` | App-Icons und iOS-Startbilder neu erzeugen |

## Deploy als statische Seite

`npm run build` erzeugt in `dist/` eine vollständig statische Seite. Der Build
nutzt `base: './'` und Hash-Routing (`#/verlauf`), läuft also auch in einem
Unterverzeichnis und braucht keine Server-Rewrites. Den Inhalt von `dist/` auf
einen beliebigen Static-Host legen (GitHub Pages, Netlify, eigener Webspace).

**HTTPS ist Pflicht**, sonst registriert Safari keinen Service Worker und die
App funktioniert weder offline noch als Home-Bildschirm-App. Ausnahme:
`http://localhost` gilt als sicherer Kontext und eignet sich zum Ausprobieren.

Auf dem iPhone: Seite in Safari öffnen, Teilen → „Zum Home-Bildschirm". Danach
startet die App ohne Browser-Leiste im Standalone-Modus.

## Icons und Startbilder

`npm run icons` erzeugt alle PNGs nach `public/icons/` und schreibt die
`apple-touch-startup-image`-Verweise in `index.html` zwischen die Marker
`splash:start` und `splash:end`. Das Motiv steht als Code in
`scripts/generate-icons.mjs`, gezeichnet über einen kleinen PNG-Encoder auf
Basis von `node:zlib` — kein zusätzliches Paket, jederzeit reproduzierbar.

Die Verweise also nicht von Hand pflegen: Wer ein Gerät ergänzen will, trägt es
in `DEVICES` ein und lässt das Skript laufen. Die Icons liegen im Offline-Cache,
die Startbilder bewusst nicht — die holt iOS beim Installieren selbst, im
Betrieb braucht sie niemand.

## Updates

Ein neuer Stand wird nie still eingespielt. Der Service Worker installiert ihn
im Hintergrund und wartet; die App zeigt oben einen Balken mit *Neu laden*.
Gesucht wird beim Start und immer dann, wenn die App wieder in den Vordergrund
kommt — eine Home-Bildschirm-App wird sonst monatelang nicht neu geladen.

## Sicherung

Der wahrscheinlichste Datenverlust ist gelöschter Browser-Speicher, nicht ein
Bug. Deshalb unter *Einstellungen*:

- **Voll-Export (JSON)** — alle Tabellen inklusive `schemaVersion`. Das ist die
  einzige vollständige Sicherung; ab 14 Tagen ohne Export mahnt der Startscreen.
- **CSV-Export** der Buchungen, semikolongetrennt mit deutschem Dezimalkomma für
  Excel. Nur zum Weiterverarbeiten, nicht importierbar.
- **Import** wahlweise als *Zusammenführen* (nach `id`) oder *Ersetzen*, jeweils
  mit Vorschau vor dem Schreiben. Ältere Backups laufen durch dieselbe
  Migrationskette wie die Datenbank.

## Aufbau

```
src/
  app/        Routing, Persistenz-Anfrage, Update-Hinweis
  backup/     Export, Import, Validierung, Migrationen, CSV
  db/         Dexie-Schema, Repositories, Seed-Kategorien
  features/   Screens: capture, shopping, analysis, recurring, history, settings
  lib/        Beträge (Cent), Datumsarithmetik, Wiederholungen, Aggregation, IDs
  styles/     globales CSS mit Custom Properties
```

Grundregeln, die überall gelten:

- Beträge sind **Integer in Cent**, niemals Floats.
- Datumsangaben sind ISO-Strings `YYYY-MM-DD` in **lokaler** Zeit. Kein
  `new Date('2026-01-31')`, kein `toISOString().slice(0, 10)` — beides schiebt
  Buchungen über Monatsgrenzen.
- Kategorien werden nie gelöscht, nur archiviert. Startkategorien haben feste
  IDs; nachträglich ergänzte bekommen die nächste freie Nummer, damit sich die
  IDs bestehender Einträge nicht verschieben.
- Wiederkehrende Buchungen sind idempotent: `lastPostedDate` je Regel plus eine
  Prüfung auf vorhandene Buchungen zu `recurringRuleId` und Datum, beides in
  einer Transaktion. Dieselbe Periode wird nie zweimal gebucht.

## Auswertung

Die Aggregation liegt in `src/lib/analytics.ts` und ist frei von Datenbank und
Chart.js — dadurch ist sie direkt testbar. Zwei Regeln, die dort überall gelten:

- Monatsreihen sind lückenlos. Ein Monat ohne Buchungen ist eine 0 und fällt
  nicht aus der Reihe, sonst lügen die Achsen.
- Ausnahme sind die kumulierten Jahresausgaben: Monate, die noch nicht
  angebrochen sind, bleiben `null`. Eine kumulierte Linie fällt nicht auf null
  zurück, nur weil das Jahr noch läuft.

Chart.js wird nur mit den benutzten Bausteinen registriert, und der ganze
Auswertungs-Screen lädt als eigener Chunk — der Erfassen-Screen wartet nicht auf
Diagrammcode, der Service Worker legt ihn trotzdem in den Offline-Cache.

## Schema-Versionen

`SCHEMA_VERSION` in `src/db/db.ts` gilt für die Datenbank *und* für das
Backup-Format. Eine neue Version braucht beides: eine Dexie-`version(n).upgrade()`
und einen Schritt in `MIGRATIONS` in `src/backup/migrate.ts`.

| Version | Änderung |
| --- | --- |
| 1 | Ausgangsschema: `transactions`, `categories`, `recurringRules`, `shoppingItems`, `settings` |
| 2 | `shoppingItems.onList` — trennt Artikel auf der Liste von Staples in der Vorschlagsleiste |
| 3 | Startkategorie „Abos" ergänzt (feste Kosten) |

## Stand

| Phase | Inhalt | Status |
| --- | --- | --- |
| 1 | Datenschicht, Kategorien-Seed, Erfassen, Verlauf, Export/Import | fertig |
| 2 | Einkaufsliste inklusive Kopplung an Buchungen | fertig |
| 3 | Fixkosten-Regeln mit Fälligkeitslogik | fertig |
| 4 | Auswertung und Charts | fertig |
| 5 | PWA-Feinschliff: Icons, Splash, Safe Areas, Update-Prompt | fertig |

Die Tab-Bar ist mit *Erfassen, Liste, Auswertung, Fixkosten, Verlauf* bei ihrem
Maximum von fünf Einträgen; *Einstellungen* sitzt deshalb als Zahnrad im Kopf
der App.
