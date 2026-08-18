import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type KostenDB } from './db';
import { seedCategoryId } from './seed';
import {
  addShoppingItem,
  listShoppingItems,
  listStapleSuggestions,
  toggleShoppingItem,
} from './shopping';
import { buildShoppingNote, finishShopping, undoShopping } from './shoppingCheckout';
import type { ShoppingItem } from './types';

let db: KostenDB;
let counter = 0;

const LEBENSMITTEL = seedCategoryId('Lebensmittel');

beforeEach(async () => {
  counter += 1;
  db = createDb(`kostentracker-checkout-${Date.now()}-${counter}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

async function add(name: string, isStaple = false): Promise<ShoppingItem> {
  const item = await addShoppingItem({ name, isStaple }, db);
  return item!;
}

describe('Einkauf abschließen', () => {
  it('erzeugt genau eine Buchung mit den abgehakten Artikeln als Notiz', async () => {
    const milch = await add('Milch', true);
    const brot = await add('Brot');
    await add('Chips');
    await toggleShoppingItem(milch.id, db);
    await toggleShoppingItem(brot.id, db);

    const result = await finishShopping(
      {
        date: '2026-08-18',
        amountCents: 4237,
        categoryId: LEBENSMITTEL,
        merchant: 'Wochenmarkt',
      },
      db,
    );

    const transactions = await db.transactions.toArray();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      amountCents: 4237,
      source: 'shopping',
      merchant: 'Wochenmarkt',
      note: 'Milch, Brot',
      categoryId: LEBENSMITTEL,
      date: '2026-08-18',
    });
    expect(result.transaction.id).toBe(transactions[0]?.id);
  });

  it('räumt die Liste auf: Staples zurück in die Vorschläge, Rest gelöscht', async () => {
    const milch = await add('Milch', true);
    const brot = await add('Brot');
    const chips = await add('Chips');
    await toggleShoppingItem(milch.id, db);
    await toggleShoppingItem(brot.id, db);

    await finishShopping(
      { date: '2026-08-18', amountCents: 1000, categoryId: LEBENSMITTEL },
      db,
    );

    // Nicht abgehakte Artikel bleiben liegen.
    expect((await listShoppingItems(db)).map((item) => item.id)).toEqual([chips.id]);
    expect((await listStapleSuggestions(db)).map((item) => item.name)).toEqual(['Milch']);
    expect(await db.shoppingItems.get(brot.id)).toBeUndefined();

    const staple = await db.shoppingItems.get(milch.id);
    expect(staple?.done).toBe(false);
    expect(staple && 'doneAt' in staple).toBe(false);
  });

  it('zählt die Kategorienutzung wie eine normale Buchung', async () => {
    const milch = await add('Milch');
    await toggleShoppingItem(milch.id, db);
    await finishShopping(
      { date: '2026-08-18', amountCents: 500, categoryId: LEBENSMITTEL },
      db,
    );
    expect((await db.categories.get(LEBENSMITTEL))?.usageCount).toBe(1);
  });

  it('nimmt den Abschluss vollständig zurück', async () => {
    const milch = await add('Milch', true);
    const brot = await add('Brot');
    await toggleShoppingItem(milch.id, db);
    await toggleShoppingItem(brot.id, db);
    const before = await listShoppingItems(db);

    const result = await finishShopping(
      { date: '2026-08-18', amountCents: 4237, categoryId: LEBENSMITTEL },
      db,
    );
    await undoShopping(result, db);

    expect(await db.transactions.count()).toBe(0);
    expect((await db.categories.get(LEBENSMITTEL))?.usageCount).toBe(0);
    expect(await listShoppingItems(db)).toEqual(before);
    expect(await listStapleSuggestions(db)).toHaveLength(0);
  });

  it('bucht auch ohne abgehakte Artikel eine leere Notiz statt zu scheitern', async () => {
    const result = await finishShopping(
      { date: '2026-08-18', amountCents: 999, categoryId: LEBENSMITTEL },
      db,
    );
    const stored = await db.transactions.get(result.transaction.id);
    expect(stored && 'note' in stored).toBe(false);
    expect(result.previousItems).toEqual([]);
  });
});

describe('Notiz aus Artikeln', () => {
  function item(name: string, quantity?: string): ShoppingItem {
    const record: ShoppingItem = {
      id: name,
      name,
      done: true,
      isStaple: false,
      onList: true,
      addedAt: '2026-08-18T08:00:00.000Z',
      sortOrder: 0,
    };
    if (quantity) record.quantity = quantity;
    return record;
  }

  it('nimmt Mengenangaben mit', () => {
    expect(buildShoppingNote([item('Milch'), item('Butter', '2 Pack')])).toBe(
      'Milch, 2 Pack Butter',
    );
  });

  it('kürzt sehr lange Listen', () => {
    const many = Array.from({ length: 100 }, (_, index) => item(`Artikel ${index}`));
    const note = buildShoppingNote(many);
    expect(note.length).toBeLessThanOrEqual(400);
    expect(note.endsWith('…')).toBe(true);
  });

  it('bleibt bei leerer Liste leer', () => {
    expect(buildShoppingNote([])).toBe('');
  });
});
