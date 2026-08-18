import { newId, nowISO } from '../lib/ids';
import { db as defaultDb, type KostenDB } from './db';
import type { ShoppingItem } from './types';

/** Vergleichsform fuer Duplikate: Gross-/Kleinschreibung und Rand egal. */
function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('de');
}

function bySortOrder(a: ShoppingItem, b: ShoppingItem): number {
  return a.sortOrder - b.sortOrder;
}

/** Artikel, die gerade auf der Liste liegen — offene wie abgehakte. */
export async function listShoppingItems(
  database: KostenDB = defaultDb,
): Promise<ShoppingItem[]> {
  const rows = await database.shoppingItems.toArray();
  return rows.filter((item) => item.onList).sort(bySortOrder);
}

/**
 * Vorschlagsleiste: Staples, die gerade nicht auf der Liste liegen. Nach dem
 * Abschluss eines Einkaufs landen sie hier statt im Nichts.
 */
export async function listStapleSuggestions(
  database: KostenDB = defaultDb,
): Promise<ShoppingItem[]> {
  const rows = await database.shoppingItems.toArray();
  return rows
    .filter((item) => item.isStaple && !item.onList)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export interface NewShoppingItemInput {
  name: string;
  quantity?: string;
  isStaple?: boolean;
}

/**
 * Legt einen Artikel an. Steht derselbe Name schon offen auf der Liste, wird
 * kein Duplikat erzeugt — beim schnellen Tippen waehrend des Einkaufs passiert
 * das sonst staendig.
 */
export async function addShoppingItem(
  input: NewShoppingItemInput,
  database: KostenDB = defaultDb,
): Promise<ShoppingItem | null> {
  const name = input.name.trim();
  if (name === '') return null;
  const quantity = input.quantity?.trim();

  return database.transaction('rw', database.shoppingItems, async () => {
    const rows = await database.shoppingItems.toArray();
    const duplicate = rows.find(
      (item) => item.onList && !item.done && normalizeName(item.name) === normalizeName(name),
    );
    if (duplicate) {
      if (quantity && quantity !== duplicate.quantity) {
        await database.shoppingItems.update(duplicate.id, { quantity });
        return { ...duplicate, quantity };
      }
      return duplicate;
    }

    // Ein Staple, der nur als Vorschlag existiert, kommt zurueck auf die Liste.
    const suggestion = rows.find(
      (item) => !item.onList && normalizeName(item.name) === normalizeName(name),
    );
    const maxOrder = rows.reduce((max, item) => Math.max(max, item.sortOrder), -1);

    if (suggestion) {
      const revived: ShoppingItem = {
        ...suggestion,
        done: false,
        onList: true,
        sortOrder: maxOrder + 1,
        isStaple: input.isStaple ?? suggestion.isStaple,
      };
      if (quantity) revived.quantity = quantity;
      else delete revived.quantity;
      delete revived.doneAt;
      await database.shoppingItems.put(revived);
      return revived;
    }

    const item: ShoppingItem = {
      id: newId(),
      name,
      done: false,
      isStaple: input.isStaple ?? false,
      onList: true,
      addedAt: nowISO(),
      sortOrder: maxOrder + 1,
    };
    if (quantity) item.quantity = quantity;
    await database.shoppingItems.add(item);
    return item;
  });
}

/** Tap auf die Zeile: abhaken bzw. Haken wieder wegnehmen. */
export async function toggleShoppingItem(
  id: string,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.shoppingItems, async () => {
    const item = await database.shoppingItems.get(id);
    if (!item) return;
    const next: ShoppingItem = { ...item, done: !item.done };
    if (next.done) next.doneAt = nowISO();
    else delete next.doneAt;
    await database.shoppingItems.put(next);
  });
}

export async function setStaple(
  id: string,
  isStaple: boolean,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.shoppingItems.update(id, { isStaple });
}

/**
 * Wischen = von der Liste entfernen. Staples bleiben als Vorschlag erhalten,
 * alles andere wird geloescht.
 */
export async function removeFromList(
  id: string,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.shoppingItems, async () => {
    const item = await database.shoppingItems.get(id);
    if (!item) return;
    if (item.isStaple) {
      const next: ShoppingItem = { ...item, onList: false, done: false };
      delete next.doneAt;
      await database.shoppingItems.put(next);
    } else {
      await database.shoppingItems.delete(id);
    }
  });
}

/** Endgueltig weg — auch als Vorschlag. */
export async function deleteShoppingItem(
  id: string,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.shoppingItems.delete(id);
}

export function itemLabel(item: ShoppingItem): string {
  return item.quantity ? `${item.quantity} ${item.name}` : item.name;
}
