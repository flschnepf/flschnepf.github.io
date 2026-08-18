import type { ISODate } from '../lib/dates';
import { newId, nowISO } from '../lib/ids';
import { db as defaultDb, type KostenDB } from './db';
import type { Transaction, TransactionSource } from './types';

export interface NewTransactionInput {
  date: ISODate;
  amountCents: number;
  categoryId: string;
  merchant?: string;
  note?: string;
  source?: TransactionSource;
  recurringRuleId?: string;
}

export type TransactionPatch = Partial<
  Pick<Transaction, 'date' | 'amountCents' | 'categoryId' | 'merchant' | 'note'>
>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * `usageCount` zaehlt die Buchungen je Kategorie und sortiert die Chips auf dem
 * Erfassen-Screen. Wird beim Loeschen wieder heruntergezaehlt, damit Undo den
 * Ausgangszustand exakt herstellt.
 */
async function bumpUsage(database: KostenDB, categoryId: string, delta: number): Promise<void> {
  const category = await database.categories.get(categoryId);
  if (!category) return;
  await database.categories.update(categoryId, {
    usageCount: Math.max(0, category.usageCount + delta),
  });
}

export async function createTransaction(
  input: NewTransactionInput,
  database: KostenDB = defaultDb,
): Promise<Transaction> {
  const timestamp = nowISO();
  const record: Transaction = {
    id: newId(),
    date: input.date,
    amountCents: Math.trunc(input.amountCents),
    categoryId: input.categoryId,
    source: input.source ?? 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const merchant = clean(input.merchant);
  if (merchant) record.merchant = merchant;
  const note = clean(input.note);
  if (note) record.note = note;
  if (input.recurringRuleId) record.recurringRuleId = input.recurringRuleId;

  await database.transaction('rw', database.transactions, database.categories, async () => {
    await database.transactions.add(record);
    await bumpUsage(database, record.categoryId, 1);
  });
  return record;
}

export async function updateTransaction(
  id: string,
  patch: TransactionPatch,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.transactions, database.categories, async () => {
    const existing = await database.transactions.get(id);
    if (!existing) return;

    const next: Transaction = { ...existing, updatedAt: nowISO() };
    if (patch.date !== undefined) next.date = patch.date;
    if (patch.amountCents !== undefined) next.amountCents = Math.trunc(patch.amountCents);
    if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
    if (patch.merchant !== undefined) {
      const merchant = clean(patch.merchant);
      if (merchant) next.merchant = merchant;
      else delete next.merchant;
    }
    if (patch.note !== undefined) {
      const note = clean(patch.note);
      if (note) next.note = note;
      else delete next.note;
    }

    await database.transactions.put(next);
    if (next.categoryId !== existing.categoryId) {
      await bumpUsage(database, existing.categoryId, -1);
      await bumpUsage(database, next.categoryId, 1);
    }
  });
}

export async function deleteTransaction(
  id: string,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.transactions, database.categories, async () => {
    const existing = await database.transactions.get(id);
    if (!existing) return;
    await database.transactions.delete(id);
    await bumpUsage(database, existing.categoryId, -1);
  });
}

export interface TransactionFilter {
  /** Inklusive Untergrenze. */
  from?: ISODate;
  /** Inklusive Obergrenze. */
  to?: ISODate;
  categoryId?: string;
}

/** Neueste zuerst; bei gleichem Datum zuletzt erfasste zuerst. */
export async function queryTransactions(
  filter: TransactionFilter = {},
  database: KostenDB = defaultDb,
): Promise<Transaction[]> {
  const from = filter.from ?? '0000-01-01';
  const to = filter.to ?? '9999-12-31';

  const rows = filter.categoryId
    ? await database.transactions
        .where('[categoryId+date]')
        .between([filter.categoryId, from], [filter.categoryId, to], true, true)
        .toArray()
    : await database.transactions.where('date').between(from, to, true, true).toArray();

  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function sumCents(transactions: Transaction[]): number {
  return transactions.reduce((total, item) => total + item.amountCents, 0);
}
