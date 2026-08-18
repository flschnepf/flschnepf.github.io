# Projektspezifikation: Lokaler Kosten-Tracker (PWA)

Diese Datei ist die verbindliche Spezifikation. Lege sie als `SPEC.md` ins Repo-Root und arbeite die Phasen der Reihe nach ab. Bei Konflikten zwischen dieser Datei und späteren Zurufen gilt: nachfragen, nicht raten.

## 1. Ziel

Eine persönliche App zum Erfassen und Auswerten von Haushaltskosten (Einkäufe, Strom, Gas, Rundfunkbeitrag, Versicherungen etc.) mit integrierter Einkaufsliste. Ein einziger Nutzer, ein Gerät.

## 2. Harte Rahmenbedingungen

- **Rein lokal.** Alle Daten liegen in IndexedDB auf dem Gerät. Kein Backend, kein Account, keine Synchronisierung, keine Telemetrie, keine Fehler-Reporting-Dienste.
- **Keine Netzwerkzugriffe zur Laufzeit.** Alle Assets (Fonts, Icons, Libraries) werden gebundelt. Keine CDN-Referenzen, keine Google Fonts, keine externen Icon-Sprites.
- **Zielplattform:** iPhone, Safari, installiert als Home-Bildschirm-App (`display: standalone`). Desktop-Browser soll funktionieren, ist aber nicht der Designfokus.
- **Offline-first.** Nach dem ersten Laden vollständig ohne Netz nutzbar.
- **Kostenlos in Betrieb und Entwicklung.** Kein Apple Developer Account, kein Xcode.

## 3. Tech-Stack (vorgegeben, nicht zur Diskussion)

- Vite + React + TypeScript (strict mode)
- Dexie.js für IndexedDB inkl. Dexie-Migrations
- `vite-plugin-pwa` für Manifest und Service Worker
- Chart.js v4 für Visualisierungen
- date-fns für Datumsarithmetik
- CSS Modules oder vanilla CSS mit Custom Properties. Kein Tailwind, kein UI-Framework, keine Komponentenbibliothek.
- Vitest für Unit-Tests

Keine weiteren Runtime-Dependencies ohne Rückfrage.

## 4. Datenmodell

Alle Beträge sind **Integer in Cent**. Niemals Floats für Geld. Alle Datumsangaben sind ISO-Strings `YYYY-MM-DD` in lokaler Zeit — keine UTC-Konvertierung, sonst rutschen Buchungen über Monatsgrenzen. IDs via `crypto.randomUUID()`.

### `transactions`
`id`, `date`, `amountCents` (positiv = Ausgabe, negativ = Erstattung/Gutschrift), `categoryId`, `merchant` (optional), `note` (optional), `source` (`manual` | `recurring` | `shopping`), `recurringRuleId` (optional), `createdAt`, `updatedAt`
Indizes auf `date`, `categoryId`, `[categoryId+date]`.

### `categories`
`id`, `name`, `parentId` (optional, eine Ebene Verschachtelung genügt), `color`, `kind` (`fix` | `variabel`), `archived`, `sortOrder`, `usageCount`
Kategorien werden nie gelöscht, nur archiviert — sonst brechen historische Buchungen.
Seed-Kategorien: Lebensmittel, Drogerie, Strom, Gas/Heizung, Wasser, Rundfunkbeitrag, Internet/Mobilfunk, Versicherungen, Miete, Mobilität, Restaurant, Anschaffungen, Sonstiges.

### `recurringRules`
`id`, `name`, `categoryId`, `amountCents`, `interval` (`monthly` | `quarterly` | `yearly`), `dayOfMonth`, `startDate`, `endDate` (optional), `autoPost` (bool), `lastPostedDate`, `active`
Beim App-Start werden fällige Buchungen ermittelt. Bei `autoPost = true` direkt anlegen, sonst als Liste "fällig, bitte bestätigen" anzeigen. **Idempotenz ist Pflicht:** dieselbe Regel darf für dieselbe Periode nie zweimal buchen, auch nicht wenn die App fünfmal am Tag geöffnet wird.

### `shoppingItems`
`id`, `name`, `quantity` (optional, freier Text wie "2 Pack"), `done` (bool), `isStaple` (bool), `addedAt`, `doneAt` (optional), `sortOrder`
`isStaple` markiert wiederkehrende Artikel, die nach Abschluss eines Einkaufs nicht verschwinden, sondern in einer Vorschlagsleiste bleiben und mit einem Tap wieder auf die Liste kommen.

### `settings`
Key-Value-Tabelle: Währung (fest EUR), letzter Export-Zeitpunkt, Onboarding-Status, Persistenz-Status.

## 5. Kopplung Einkaufsliste ↔ Buchung

Das ist das zentrale Feature, nicht ein Anhängsel: Die Einkaufsliste ist der Einstiegspunkt, über den Buchungen nebenbei entstehen.

Ablauf: Auf der Liste werden Artikel während des Einkaufs abgehakt. Der Button **"Einkauf abschließen"** öffnet einen einzelnen Dialog mit Bon-Summe, Händler und Kategorie (vorbelegt: Lebensmittel). Bestätigen erzeugt genau eine Buchung mit `source = shopping`, die abgehakten Artikel werden als Notiz angehängt und von der Liste entfernt; Staples wandern zurück in die Vorschläge.

**Ausdrücklich nicht:** Einzelpreise pro Artikel. Nur die Bon-Summe. Preiserfassung pro Artikel klingt nach besseren Daten und führt in der Praxis dazu, dass die App nach drei Wochen nicht mehr benutzt wird.

## 6. Screens

1. **Erfassen** (Startscreen): Numpad-Eingabe für den Betrag, darunter Kategorie-Chips sortiert nach `usageCount`, Datum vorbelegt auf heute, optionales Notizfeld. Speichern muss in unter 10 Sekunden und ohne Scrollen möglich sein. Danach kurze Bestätigung mit Undo, kein Screenwechsel.
2. **Einkaufsliste**: Eingabefeld oben (Enter fügt hinzu und behält Fokus), Tap = erledigt, Wischen = löschen, Vorschlagsleiste mit Staples, "Einkauf abschließen".
3. **Auswertung**: siehe Abschnitt 7.
4. **Fixkosten**: Regeln anlegen/bearbeiten, Liste fälliger Buchungen zum Bestätigen.
5. **Verlauf**: chronologische Buchungsliste, Filter nach Zeitraum und Kategorie, Bearbeiten und Löschen.
6. **Einstellungen**: Kategorien verwalten, Export/Import, Backup-Status, Speicher-Persistenz.

Navigation als Tab-Bar am unteren Rand (Daumenreichweite), maximal fünf Einträge. Keine gestapelten Modals.

## 7. Visualisierungen

- Monatssumme mit Delta zum Vormonat und zum gleitenden 3-Monats-Durchschnitt
- Gestapelte Balken über 12 Monate, gruppiert nach Kategorie
- Anteil aktueller Monat nach Kategorie (Donut), Tap auf Segment führt in den Drilldown
- Fixkosten vs. variable Kosten im Zeitverlauf
- Kumulierte Jahresausgaben mit Vorjahr als Vergleichslinie
- Kategorie-Drilldown: Zeitreihe plus zugehörige Einzelbuchungen

Alle Charts müssen mit leerem und mit lückenhaftem Datenbestand umgehen (fehlende Monate = 0, nicht auslassen).

## 8. Export, Import, Persistenz — Phase 1, nicht später

Der wahrscheinlichste Totalverlust ist gelöschter Browser-Speicher, nicht ein Bug.

- **Voll-Export:** JSON mit allen Tabellen plus `schemaVersion` und Zeitstempel, über die Share-API bzw. als Download in die Dateien-App.
- **CSV-Export** der Buchungen separat, semikolongetrennt, deutsches Dezimalkomma (Excel-kompatibel).
- **Import** mit expliziter Auswahl "Zusammenführen" (nach `id`) oder "Ersetzen", mit Vorschau der betroffenen Datensätze und Bestätigung. Import älterer `schemaVersion` muss durch dieselben Migrationen laufen wie die Datenbank.
- **Roundtrip-Test:** Export → Import in leere DB → identischer Datenbestand. Das ist ein Pflicht-Testfall.
- `navigator.storage.persist()` beim ersten Start anfragen, Ergebnis in den Einstellungen anzeigen.
- Banner auf dem Startscreen, wenn der letzte Export älter als 14 Tage ist.

## 9. Umsetzungsreihenfolge

- **Phase 1:** Datenschicht, Kategorien-Seed, Erfassen-Screen, Verlauf, Export/Import. Keine Charts.
- **Phase 2:** Einkaufsliste inklusive Kopplung an Buchungen.
- **Phase 3:** Fixkosten-Regeln mit Fälligkeitslogik.
- **Phase 4:** Auswertung und Charts.
- **Phase 5:** PWA-Feinschliff — Icons, Splash, Standalone-Verhalten, Safe Areas, Update-Prompt.

Nach jeder Phase: lauffähiger Stand, Tests grün, kurzer Hinweis was noch fehlt. Nicht mehrere Phasen in einem Rutsch.

## 10. Nicht-Ziele

Keine Bankanbindung, kein FinTS, kein Cloud-Sync, kein Login, kein Multi-User, keine Fremdwährungen, keine Bon-Erkennung per OCR, keine Budget-Benachrichtigungen. Wenn eines davon sinnvoll erscheint: vorschlagen, nicht bauen.

## 11. iOS-spezifische Fallstricke

- `100vh` ist auf iOS Safari unbrauchbar — `100dvh` und `env(safe-area-inset-*)` verwenden.
- Eingabefelder mindestens `font-size: 16px`, sonst zoomt Safari beim Fokussieren.
- Für Beträge ein eigenes Numpad statt `input type="number"`; ansonsten `inputmode="decimal"`.
- Im Standalone-Modus gibt es keinen Browser-Zurück-Button: eigene Navigation, History-API sauber führen.
- Service-Worker-Updates nicht still einspielen, sondern mit Hinweis und Neuladen-Button.
- Dexie-Transaktionen nicht über `await` auf fremde Promises hinweg offen halten, sonst brechen sie in WebKit ab.
- Kein `alert()`/`confirm()` — im Standalone-Modus unschön und blockierend.

## 12. Gestaltung

Werkzeug, kein Dashboard. Dichte Darstellung, tabellarische Ziffern für Beträge, hohe Kontraste, Dark Mode über `prefers-color-scheme`. Kategoriefarben tragen Information und sind die einzige kräftige Farbe im Interface — der Rest bleibt neutral. Animationen nur dort, wo sie Zustandswechsel erklären (Undo, Abhaken), `prefers-reduced-motion` respektieren. Touch-Ziele mindestens 44×44 pt.

## 13. Qualität

- Unit-Tests für: Betragsparsing (Komma, Punkt, negative Werte), Monatsgrenzen und Zeitzonen, Fälligkeitsberechnung wiederkehrender Regeln inklusive Idempotenz, Export/Import-Roundtrip, Aggregation für die Charts.
- Keine `any`-Typen ohne Kommentar.
- README mit Setup, Build und Deploy als statische Seite.
