import type { ISODate } from '../lib/dates';
import { db as defaultDb, type KostenDB } from './db';
import { itemLabel } from './shopping';
import { createTransaction, deleteTransaction } from './transactions';
import type { ShoppingItem, Transaction } from './types';

/** Laengere Notizen bringen in der Verlaufsliste nichts mehr. */
const MAX_NOTE_LENGTH = 400;

export interface FinishShoppingInput {
  date: ISODate;
  /** Bon-Summe, nicht Einzelpreise. */
  amountCents: number;
  categoryId: string;
  merchant?: string;
}

export interface FinishShoppingResult {
  transaction: Transaction;
  /** Zustand der betroffenen Artikel vor dem Abschluss — Grundlage fuer Undo. */
  previousItems: ShoppingItem[];
}

/** "Milch, 2 Pack Butter, Brot" — abgeschnitten, bevor es unlesbar wird. */
export function buildShoppingNote(items: ShoppingItem[]): string {
  const full = items.map(itemLabel).join(', ');
  if (full.length <= MAX_NOTE_LENGTH) return full;
  return `${full.slice(0, MAX_NOTE_LENGTH - 1).trimEnd()}…`;
}

/**
 * Das Herzstueck der Kopplung: aus einem abgeschlossenen Einkauf wird genau
 * *eine* Buchung. Abgehakte Artikel verlassen die Liste, Staples wandern in die
 * Vorschlaege zurueck. Alles in einer Transaktion — es darf nie eine Buchung
 * ohne aufgeraeumte Liste geben und umgekehrt.
 */
export async function finishShopping(
  input: FinishShoppingInput,
  database: KostenDB = defaultDb,
): Promise<FinishShoppingResult> {
  return database.transaction(
    'rw',
    database.transactions,
    database.categories,
    database.shoppingItems,
    async () => {
      const all = await database.shoppingItems.toArray();
      const checked = all
        .filter((item) => item.onList && item.done)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const transaction = await createTransaction(
        {
          date: input.date,
          amountCents: input.amountCents,
          categoryId: input.categoryId,
          merchant: input.merchant,
          note: buildShoppingNote(checked),
          source: 'shopping',
        },
        database,
      );

      const staples = checked.filter((item) => item.isStaple);
      const disposable = checked.filter((item) => !item.isStaple);

      if (disposable.length > 0) {
        await database.shoppingItems.bulkDelete(disposable.map((item) => item.id));
      }
      if (staples.length > 0) {
        await database.shoppingItems.bulkPut(
          staples.map((item) => {
            const next: ShoppingItem = { ...item, done: false, onList: false };
            delete next.doneAt;
            return next;
          }),
        );
      }

      return { transaction, previousItems: checked };
    },
  );
}

/** Macht `finishShopping` rueckgaengig: Buchung weg, Liste wie vorher. */
export async function undoShopping(
  result: FinishShoppingResult,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.transaction(
    'rw',
    database.transactions,
    database.categories,
    database.shoppingItems,
    async () => {
      await deleteTransaction(result.transaction.id, database);
      if (result.previousItems.length > 0) {
        await database.shoppingItems.bulkPut(result.previousItems);
      }
    },
  );
}
