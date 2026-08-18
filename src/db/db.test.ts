import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listCategories, listCategoriesByUsage, setCategoryArchived } from './categories';
import { createDb, type KostenDB } from './db';
import { SEED_CATEGORY_IDS, seedCategoryId } from './seed';
import {
  createTransaction,
  deleteTransaction,
  queryTransactions,
  sumCents,
  updateTransaction,
} from './transactions';

let db: KostenDB;
let dbCounter = 0;

beforeEach(async () => {
  dbCounter += 1;
  db = createDb(`kostentracker-test-${Date.now()}-${dbCounter}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('Kategorien-Seed', () => {
  it('legt die Startkategorien in Anzeigereihenfolge an', async () => {
    const categories = await listCategories(db);
    expect(categories.map((category) => category.name)).toEqual([
      'Lebensmittel',
      'Drogerie',
      'Strom',
      'Gas/Heizung',
      'Wasser',
      'Rundfunkbeitrag',
      'Internet/Mobilfunk',
      'Versicherungen',
      'Abos',
      'Miete',
      'Mobilität',
      'Restaurant',
      'Anschaffungen',
      'Sonstiges',
    ]);
    expect(categories.map((category) => category.id)).toEqual(SEED_CATEGORY_IDS);
    expect(categories.every((category) => category.usageCount === 0)).toBe(true);
    expect(categories.every((category) => category.archived === false)).toBe(true);
  });

  it('hält die IDs bestehender Kategorien fest', async () => {
    // Nachträglich ergänzte Kategorien dürfen die IDs der anderen nicht verschieben,
    // sonst zeigen Buchungen aus älteren Backups ins Leere.
    expect(seedCategoryId('Lebensmittel')).toBe('00000000-0000-4000-8000-000000000001');
    expect(seedCategoryId('Miete')).toBe('00000000-0000-4000-8000-000000000009');
    expect(seedCategoryId('Sonstiges')).toBe('00000000-0000-4000-8000-000000000013');
    expect(seedCategoryId('Abos')).toBe('00000000-0000-4000-8000-000000000014');
    expect(new Set(SEED_CATEGORY_IDS).size).toBe(SEED_CATEGORY_IDS.length);
  });

  it('kennt fixe und variable Kosten', async () => {
    const categories = await listCategories(db);
    const byName = (name: string) => categories.find((category) => category.name === name);
    expect(byName('Miete')?.kind).toBe('fix');
    expect(byName('Abos')?.kind).toBe('fix');
    expect(byName('Lebensmittel')?.kind).toBe('variabel');
  });

  it('blendet archivierte Kategorien aus der Chip-Liste aus', async () => {
    const [first] = await listCategories(db);
    await setCategoryArchived(first!.id, true, db);
    const chips = await listCategoriesByUsage(db);
    expect(chips.map((category) => category.id)).not.toContain(first!.id);
    expect(await listCategories(db)).toHaveLength(SEED_CATEGORY_IDS.length);
  });
});

describe('Buchungen', () => {
  const category = () => seedCategoryId('Lebensmittel');

  it('speichert Cent-Beträge und Standardwerte', async () => {
    const created = await createTransaction(
      { date: '2026-08-18', amountCents: 1234, categoryId: category() },
      db,
    );
    const stored = await db.transactions.get(created.id);
    expect(stored?.amountCents).toBe(1234);
    expect(stored?.source).toBe('manual');
    expect(stored?.createdAt).toBe(stored?.updatedAt);
    // Leere Optionalfelder werden gar nicht erst geschrieben.
    expect(stored && 'merchant' in stored).toBe(false);
  });

  it('zählt die Kategorienutzung hoch und wieder herunter', async () => {
    const created = await createTransaction(
      { date: '2026-08-18', amountCents: 500, categoryId: category() },
      db,
    );
    expect((await db.categories.get(category()))?.usageCount).toBe(1);

    await deleteTransaction(created.id, db);
    expect((await db.categories.get(category()))?.usageCount).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it('verschiebt die Nutzung beim Kategoriewechsel', async () => {
    const other = seedCategoryId('Drogerie');
    const created = await createTransaction(
      { date: '2026-08-18', amountCents: 500, categoryId: category() },
      db,
    );
    await updateTransaction(created.id, { categoryId: other, note: '  Pfand  ' }, db);

    expect((await db.categories.get(category()))?.usageCount).toBe(0);
    expect((await db.categories.get(other))?.usageCount).toBe(1);

    const stored = await db.transactions.get(created.id);
    expect(stored?.note).toBe('Pfand');
    expect(stored?.categoryId).toBe(other);
  });

  it('entfernt geleerte Optionalfelder wieder', async () => {
    const created = await createTransaction(
      { date: '2026-08-18', amountCents: 500, categoryId: category(), note: 'Test' },
      db,
    );
    await updateTransaction(created.id, { note: '' }, db);
    const stored = await db.transactions.get(created.id);
    expect(stored && 'note' in stored).toBe(false);
  });

  it('filtert nach Zeitraum und Kategorie, neueste zuerst', async () => {
    const first = seedCategoryId('Lebensmittel');
    const second = seedCategoryId('Drogerie');
    await createTransaction({ date: '2026-07-31', amountCents: 100, categoryId: first }, db);
    await createTransaction({ date: '2026-08-01', amountCents: 200, categoryId: first }, db);
    await createTransaction({ date: '2026-08-31', amountCents: 300, categoryId: second }, db);
    await createTransaction({ date: '2026-09-01', amountCents: 400, categoryId: second }, db);

    const august = await queryTransactions({ from: '2026-08-01', to: '2026-08-31' }, db);
    expect(august.map((item) => item.date)).toEqual(['2026-08-31', '2026-08-01']);
    expect(sumCents(august)).toBe(500);

    const augustFirstCategory = await queryTransactions(
      { from: '2026-08-01', to: '2026-08-31', categoryId: first },
      db,
    );
    expect(augustFirstCategory).toHaveLength(1);
    expect(augustFirstCategory[0]?.amountCents).toBe(200);

    expect(await queryTransactions({}, db)).toHaveLength(4);
  });

  it('rechnet Erstattungen gegen', async () => {
    const first = seedCategoryId('Lebensmittel');
    await createTransaction({ date: '2026-08-10', amountCents: 5000, categoryId: first }, db);
    await createTransaction({ date: '2026-08-11', amountCents: -1500, categoryId: first }, db);
    expect(sumCents(await queryTransactions({}, db))).toBe(3500);
  });
});
