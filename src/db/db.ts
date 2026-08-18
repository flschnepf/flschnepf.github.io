import Dexie, { type Table } from 'dexie';
import { abosCategory, seedCategories } from './seed';
import type {
  Category,
  RecurringRule,
  SettingEntry,
  ShoppingItem,
  Transaction,
} from './types';

/**
 * Schema-Version der Datenbank. Sie steht auch im Backup und steuert dort die
 * Migrationskette (siehe `src/backup/migrate.ts`).
 */
export const SCHEMA_VERSION = 3;

export const DB_NAME = 'kostentracker';

/**
 * IndexedDB kann keine Booleans indizieren (`archived`, `done`, `active`),
 * deshalb tauchen die hier bewusst nicht als Index auf.
 */
export class KostenDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  recurringRules!: Table<RecurringRule, string>;
  shoppingItems!: Table<ShoppingItem, string>;
  settings!: Table<SettingEntry, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    this.version(1).stores({
      transactions: 'id, date, categoryId, [categoryId+date], source, recurringRuleId',
      categories: 'id, name, parentId, sortOrder, usageCount',
      recurringRules: 'id, categoryId, startDate, lastPostedDate',
      shoppingItems: 'id, sortOrder, addedAt',
      settings: 'key',
    });

    // v2: `onList` trennt Artikel auf der Liste von Staples in der
    // Vorschlagsleiste. Die Indizes bleiben unveraendert, nur die Daten wandern.
    this.version(2).upgrade((tx) =>
      tx
        .table<ShoppingItem, string>('shoppingItems')
        .toCollection()
        .modify((item) => {
          item.onList = true;
        }),
    );

    // v3: Kategorie "Abos" nachgereicht. Bestandsdatenbanken bekommen sie hier,
    // frisch angelegte ueber den Seed.
    this.version(3).upgrade(async (tx) => {
      const categories = tx.table<Category, string>('categories');
      const abos = abosCategory();
      if (!(await categories.get(abos.id))) {
        await categories.add(abos);
      }
    });

    // Laeuft nur bei einer frisch angelegten Datenbank, innerhalb deren Transaktion.
    this.on('populate', (tx) => {
      void tx.table<Category, string>('categories').bulkAdd(seedCategories());
    });
  }
}

export const db = new KostenDB();

/** Fuer Tests: eine isolierte Datenbank mit eigenem Namen. */
export function createDb(name: string): KostenDB {
  return new KostenDB(name);
}
