import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../db/db';
import { BackupError, parseBackup } from './migrate';

function fileWith(tables: Record<string, unknown[]>, version = SCHEMA_VERSION): unknown {
  return {
    app: 'kostentracker',
    schemaVersion: version,
    exportedAt: '2026-08-18T08:00:00.000Z',
    tables,
  };
}

describe('parseBackup', () => {
  it('lehnt kaputte Dateien mit klarer Meldung ab', () => {
    expect(() => parseBackup(null)).toThrow(BackupError);
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup({ schemaVersion: 1 })).toThrow(/tables/);
    expect(() => parseBackup({ app: 'anderes', schemaVersion: 1, tables: {} })).toThrow(
      /Kostentracker/,
    );
    expect(() => parseBackup({ schemaVersion: 0, tables: {} })).toThrow(/schemaVersion/);
    expect(() => parseBackup(fileWith({ transactions: 'nein' as unknown as unknown[] }))).toThrow(
      /keine Liste/,
    );
  });

  it('weist neuere Schema-Versionen zurück, statt zu raten', () => {
    expect(() => parseBackup(fileWith({}, SCHEMA_VERSION + 1))).toThrow(
      /neuere|aktualisieren/i,
    );
  });

  it('ergänzt fehlende Tabellen als leer', () => {
    const parsed = parseBackup(fileWith({}));
    expect(parsed.data.tables.transactions).toEqual([]);
    expect(parsed.data.tables.shoppingItems).toEqual([]);
    expect(parsed.problems).toEqual([]);
  });

  it('überspringt Datensätze ohne Pflichtfelder und meldet das', () => {
    const parsed = parseBackup(
      fileWith({
        transactions: [
          {
            id: 'a',
            date: '2026-08-18',
            amountCents: 100,
            categoryId: 'c1',
            source: 'manual',
            createdAt: '2026-08-18T08:00:00.000Z',
            updatedAt: '2026-08-18T08:00:00.000Z',
          },
          { id: 'b', date: '2026-02-30', amountCents: 100, categoryId: 'c1' },
          { id: 'c', date: '2026-08-18', categoryId: 'c1' },
          { date: '2026-08-18', amountCents: 100, categoryId: 'c1' },
        ],
        categories: [{ id: 'c1', name: 'Test' }, { id: 'c2' }],
      }),
    );

    expect(parsed.data.tables.transactions).toHaveLength(1);
    expect(parsed.data.tables.categories).toHaveLength(1);
    expect(parsed.problems).toHaveLength(2);
    expect(parsed.problems[0]).toMatch(/3 Buchung/);
  });

  it('setzt vernünftige Vorgaben für fehlende Nebenfelder', () => {
    const parsed = parseBackup(
      fileWith({
        transactions: [{ id: 'a', date: '2026-08-18', amountCents: 100.7, categoryId: 'c1' }],
        categories: [{ id: 'c1', name: 'Test', kind: 'unsinn' }],
      }),
    );

    const [transaction] = parsed.data.tables.transactions;
    expect(transaction?.amountCents).toBe(100);
    expect(transaction?.source).toBe('manual');
    expect(transaction?.createdAt).toBeTruthy();

    const [category] = parsed.data.tables.categories;
    expect(category?.kind).toBe('variabel');
    expect(category?.archived).toBe(false);
    expect(category?.sortOrder).toBe(0);
  });

  it('akzeptiert Dateien ohne app-Feld und normalisiert sie', () => {
    const parsed = parseBackup({ schemaVersion: SCHEMA_VERSION, tables: {} });
    expect(parsed.data.app).toBe('kostentracker');
    expect(parsed.data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.migrated).toBe(false);
  });

  it('hebt Backups aus Schema v1 auf den aktuellen Stand', () => {
    const parsed = parseBackup({
      app: 'kostentracker',
      schemaVersion: 1,
      exportedAt: '2026-08-01T08:00:00.000Z',
      tables: {
        shoppingItems: [
          { id: 's1', name: 'Milch', done: false, isStaple: true, sortOrder: 0 },
          { id: 's2', name: 'Brot', done: true, isStaple: false, sortOrder: 1 },
        ],
      },
    });

    expect(parsed.sourceVersion).toBe(1);
    expect(parsed.migrated).toBe(true);
    expect(parsed.data.schemaVersion).toBe(SCHEMA_VERSION);
    // v1 kannte keine Vorschlagsleiste: alles lag auf der Liste.
    expect(parsed.data.tables.shoppingItems.map((item) => item.onList)).toEqual([true, true]);
    expect(parsed.problems).toEqual([]);
  });

  it('ergänzt beim Import aus Schema v2 die Kategorie "Abos"', () => {
    const parsed = parseBackup({
      app: 'kostentracker',
      schemaVersion: 2,
      exportedAt: '2026-08-01T08:00:00.000Z',
      tables: {
        categories: [{ id: 'eigene', name: 'Eigene', kind: 'fix', sortOrder: 0 }],
      },
    });

    expect(parsed.migrated).toBe(true);
    const abos = parsed.data.tables.categories.find((category) => category.name === 'Abos');
    expect(abos).toBeDefined();
    expect(abos?.kind).toBe('fix');
    // Eigene Kategorien bleiben unangetastet.
    expect(parsed.data.tables.categories).toHaveLength(2);
  });

  it('legt "Abos" nicht doppelt an', () => {
    // Backup einer App, die die Kategorie schon kannte, aber noch v2 schrieb.
    const parsed = parseBackup({
      app: 'kostentracker',
      schemaVersion: 2,
      exportedAt: '2026-08-01T08:00:00.000Z',
      tables: {
        categories: [
          {
            id: '00000000-0000-4000-8000-000000000014',
            name: 'Abos',
            kind: 'fix',
            color: '#a45a9e',
            sortOrder: 8,
            usageCount: 4,
          },
        ],
      },
    });

    const abos = parsed.data.tables.categories.filter(
      (category) => category.name === 'Abos',
    );
    expect(abos).toHaveLength(1);
    // Der vorhandene Datensatz bleibt, inklusive Nutzungszähler.
    expect(abos[0]?.usageCount).toBe(4);
  });
});
