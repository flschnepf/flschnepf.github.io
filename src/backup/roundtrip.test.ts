import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, SCHEMA_VERSION, type KostenDB } from '../db/db';
import { SEED_CATEGORY_IDS, seedCategoryId } from '../db/seed';

const SEED_CATEGORY_COUNT = SEED_CATEGORY_IDS.length;
import { setSetting } from '../db/settings';
import { createTransaction } from '../db/transactions';
import { buildBackup, serializeBackup } from './exportBackup';
import { applyImport, previewImport } from './importBackup';
import { parseBackup } from './migrate';
import { BACKUP_TABLES } from './schema';

let source: KostenDB;
let target: KostenDB;
let counter = 0;

function freshDb(label: string): KostenDB {
  counter += 1;
  return createDb(`kostentracker-${label}-${Date.now()}-${counter}`);
}

/** Vollstaendiger Abzug aller Tabellen, nach Primaerschluessel sortiert. */
async function dump(db: KostenDB): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const rows = (await db.table(table).toArray()) as Array<Record<string, unknown>>;
    result[table] = rows.sort((a, b) =>
      String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)),
    );
  }
  return result;
}

async function fillWithData(db: KostenDB): Promise<void> {
  await createTransaction(
    {
      date: '2026-08-18',
      amountCents: 4237,
      categoryId: seedCategoryId('Lebensmittel'),
      merchant: 'Wochenmarkt',
      note: 'Obst; Gemüse',
    },
    db,
  );
  await createTransaction(
    { date: '2026-07-31', amountCents: -1500, categoryId: seedCategoryId('Strom'), source: 'manual' },
    db,
  );
  await createTransaction(
    { date: '2026-01-01', amountCents: 89900, categoryId: seedCategoryId('Miete') },
    db,
  );
  await setSetting('lastExportAt', '2026-08-01T10:00:00.000Z', db);
  await setSetting('onboardingDone', true, db);
}

beforeEach(async () => {
  source = freshDb('source');
  target = freshDb('target');
  await source.open();
  await target.open();
});

afterEach(async () => {
  await source.delete();
  await target.delete();
});

describe('Export/Import-Roundtrip', () => {
  it('stellt denselben Datenbestand in einer leeren Datenbank wieder her', async () => {
    await fillWithData(source);
    const before = await dump(source);

    // Ueber JSON serialisieren: genau der Weg, den die Datei nimmt.
    const raw: unknown = JSON.parse(serializeBackup(await buildBackup(source)));
    const parsed = parseBackup(raw);
    await applyImport(parsed.data, 'replace', target);

    expect(await dump(target)).toEqual(before);
    expect(parsed.problems).toEqual([]);
    expect(parsed.migrated).toBe(false);
    expect(parsed.sourceVersion).toBe(SCHEMA_VERSION);
  });

  it('behält Beträge und Datumsangaben zeichengenau', async () => {
    await fillWithData(source);
    const parsed = parseBackup(JSON.parse(serializeBackup(await buildBackup(source))));
    await applyImport(parsed.data, 'replace', target);

    const restored = await target.transactions.orderBy('date').toArray();
    expect(restored.map((item) => item.amountCents)).toEqual([89900, -1500, 4237]);
    expect(restored.map((item) => item.date)).toEqual([
      '2026-01-01',
      '2026-07-31',
      '2026-08-18',
    ]);
    expect(restored[2]?.note).toBe('Obst; Gemüse');
  });

  it('führt zusammen, ohne fremde Datensätze zu verlieren', async () => {
    await fillWithData(source);
    await createTransaction(
      { date: '2026-08-02', amountCents: 999, categoryId: seedCategoryId('Drogerie') },
      target,
    );

    const parsed = parseBackup(JSON.parse(serializeBackup(await buildBackup(source))));
    await applyImport(parsed.data, 'merge', target);

    expect(await target.transactions.count()).toBe(4);
    // Kategorien haben stabile IDs und werden daher ersetzt, nicht verdoppelt.
    expect(await target.categories.count()).toBe(SEED_CATEGORY_COUNT);
  });

  it('wirft beim Ersetzen alles Vorhandene weg', async () => {
    await createTransaction(
      { date: '2026-08-02', amountCents: 999, categoryId: seedCategoryId('Drogerie') },
      target,
    );
    const parsed = parseBackup(JSON.parse(serializeBackup(await buildBackup(source))));
    await applyImport(parsed.data, 'replace', target);

    expect(await target.transactions.count()).toBe(0);
  });

  it('zählt in der Vorschau, was passieren würde', async () => {
    await fillWithData(source);
    await createTransaction(
      { date: '2026-08-02', amountCents: 999, categoryId: seedCategoryId('Drogerie') },
      target,
    );

    const parsed = parseBackup(JSON.parse(serializeBackup(await buildBackup(source))));
    const preview = await previewImport(parsed.data, target);
    const transactions = preview.rows.find((row) => row.table === 'transactions');
    const categories = preview.rows.find((row) => row.table === 'categories');

    expect(transactions).toMatchObject({ incoming: 3, existing: 1, added: 3, overwritten: 0 });
    expect(categories).toMatchObject({
      incoming: SEED_CATEGORY_COUNT,
      existing: SEED_CATEGORY_COUNT,
      added: 0,
      overwritten: SEED_CATEGORY_COUNT,
    });
  });
});
