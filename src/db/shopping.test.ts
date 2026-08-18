import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type KostenDB } from './db';
import {
  addShoppingItem,
  deleteShoppingItem,
  listShoppingItems,
  listStapleSuggestions,
  removeFromList,
  setStaple,
  toggleShoppingItem,
} from './shopping';

let db: KostenDB;
let counter = 0;

beforeEach(async () => {
  counter += 1;
  db = createDb(`kostentracker-shopping-${Date.now()}-${counter}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

async function addAll(names: string[]): Promise<void> {
  for (const name of names) {
    await addShoppingItem({ name }, db);
  }
}

describe('Einkaufsliste', () => {
  it('hängt neue Artikel hinten an und behält die Reihenfolge', async () => {
    await addAll(['Milch', 'Brot', 'Butter']);
    const items = await listShoppingItems(db);
    expect(items.map((item) => item.name)).toEqual(['Milch', 'Brot', 'Butter']);
    expect(items.every((item) => item.onList && !item.done)).toBe(true);
  });

  it('ignoriert leere Eingaben', async () => {
    expect(await addShoppingItem({ name: '   ' }, db)).toBeNull();
    expect(await listShoppingItems(db)).toHaveLength(0);
  });

  it('legt denselben offenen Artikel nicht doppelt an', async () => {
    const first = await addShoppingItem({ name: 'Milch' }, db);
    const second = await addShoppingItem({ name: '  milch ' }, db);
    expect(second?.id).toBe(first?.id);
    expect(await listShoppingItems(db)).toHaveLength(1);
  });

  it('übernimmt dabei eine neue Mengenangabe', async () => {
    await addShoppingItem({ name: 'Butter' }, db);
    const merged = await addShoppingItem({ name: 'Butter', quantity: '2 Pack' }, db);
    expect(merged?.quantity).toBe('2 Pack');
    expect(await listShoppingItems(db)).toHaveLength(1);
  });

  it('hakt ab und wieder los', async () => {
    const item = await addShoppingItem({ name: 'Milch' }, db);
    await toggleShoppingItem(item!.id, db);
    const done = await db.shoppingItems.get(item!.id);
    expect(done?.done).toBe(true);
    expect(done?.doneAt).toBeTruthy();

    await toggleShoppingItem(item!.id, db);
    const open = await db.shoppingItems.get(item!.id);
    expect(open?.done).toBe(false);
    expect(open && 'doneAt' in open).toBe(false);
  });

  it('löscht normale Artikel beim Wischen, behält Staples als Vorschlag', async () => {
    const milch = await addShoppingItem({ name: 'Milch', isStaple: true }, db);
    const chips = await addShoppingItem({ name: 'Chips' }, db);

    await removeFromList(milch!.id, db);
    await removeFromList(chips!.id, db);

    expect(await listShoppingItems(db)).toHaveLength(0);
    expect((await listStapleSuggestions(db)).map((item) => item.name)).toEqual(['Milch']);
    expect(await db.shoppingItems.get(chips!.id)).toBeUndefined();
  });

  it('holt einen Vorschlag mit einem Tap zurück auf die Liste', async () => {
    const milch = await addShoppingItem({ name: 'Milch', isStaple: true }, db);
    await removeFromList(milch!.id, db);

    const revived = await addShoppingItem({ name: 'Milch' }, db);
    expect(revived?.id).toBe(milch!.id);
    expect(revived?.isStaple).toBe(true);
    expect(await listStapleSuggestions(db)).toHaveLength(0);
    expect(await listShoppingItems(db)).toHaveLength(1);
    expect(await db.shoppingItems.count()).toBe(1);
  });

  it('entfernt Vorschläge auf Wunsch endgültig', async () => {
    const item = await addShoppingItem({ name: 'Milch', isStaple: true }, db);
    await removeFromList(item!.id, db);
    await deleteShoppingItem(item!.id, db);
    expect(await db.shoppingItems.count()).toBe(0);
  });

  it('markiert Artikel nachträglich als Vorrat', async () => {
    const item = await addShoppingItem({ name: 'Milch' }, db);
    await setStaple(item!.id, true, db);
    expect((await db.shoppingItems.get(item!.id))?.isStaple).toBe(true);
  });
});
