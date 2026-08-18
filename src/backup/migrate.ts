import { SCHEMA_VERSION } from '../db/db';
import type {
  Category,
  RecurringRule,
  SettingEntry,
  ShoppingItem,
  Transaction,
} from '../db/types';
import { abosCategory } from '../db/seed';
import { isISODate } from '../lib/dates';
import { nowISO } from '../lib/ids';
import {
  BACKUP_APP_ID,
  BACKUP_TABLES,
  type BackupFile,
  type BackupTableName,
  type BackupTables,
} from './schema';

export class BackupError extends Error {
  override name = 'BackupError';
}

/** Rohdaten einer Backup-Datei, bevor sie validiert sind. */
type RawRow = Record<string, unknown>;
type RawTables = Record<BackupTableName, RawRow[]>;

interface RawBackup {
  schemaVersion: number;
  exportedAt: string;
  tables: RawTables;
}

/**
 * Migrationsschritte fuer Backups. Der Schluessel ist die Version, *von* der
 * migriert wird. Eine neue DB-Version heisst: hier denselben Schritt nachziehen,
 * sonst laufen aeltere Backups nicht durch (Spezifikation §8).
 */
const MIGRATIONS: Record<number, (raw: RawBackup) => RawBackup> = {
  // v1 kannte kein `onList`: Alles, was gespeichert war, lag auf der Liste.
  1: (raw) => ({
    ...raw,
    schemaVersion: 2,
    tables: {
      ...raw.tables,
      shoppingItems: raw.tables.shoppingItems.map((item) => ({ onList: true, ...item })),
    },
  }),
  // v2 kannte die Kategorie "Abos" noch nicht. Ohne diesen Schritt fehlt sie
  // nach dem Ersetzen aus einem aelteren Backup.
  2: (raw) => {
    const abos = abosCategory();
    const hasAbos = raw.tables.categories.some((category) => category.id === abos.id);
    return {
      ...raw,
      schemaVersion: 3,
      tables: {
        ...raw.tables,
        categories: hasAbos
          ? raw.tables.categories
          : [...raw.tables.categories, { ...abos }],
      },
    };
  },
};

export interface ParsedBackup {
  data: BackupFile;
  /** Version, mit der die Datei geschrieben wurde. */
  sourceVersion: number;
  migrated: boolean;
  /** Verworfene oder reparierte Datensaetze, im Import-Dialog sichtbar. */
  problems: string[];
}

function isObject(value: unknown): value is RawRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Struktur pruefen, Migrationen anwenden, Zeilen validieren. */
export function parseBackup(input: unknown): ParsedBackup {
  if (!isObject(input)) {
    throw new BackupError('Die Datei enthält kein gültiges JSON-Objekt.');
  }
  if (input.app !== undefined && input.app !== BACKUP_APP_ID) {
    throw new BackupError('Die Datei stammt nicht aus dem Kostentracker.');
  }

  const sourceVersion = num(input.schemaVersion);
  if (sourceVersion === undefined || !Number.isInteger(sourceVersion) || sourceVersion < 1) {
    throw new BackupError('In der Datei fehlt eine gültige schemaVersion.');
  }
  if (sourceVersion > SCHEMA_VERSION) {
    throw new BackupError(
      `Die Datei wurde mit Schema-Version ${sourceVersion} geschrieben, diese App kennt nur ${SCHEMA_VERSION}. Bitte zuerst die App aktualisieren.`,
    );
  }
  if (!isObject(input.tables)) {
    throw new BackupError('In der Datei fehlt der Abschnitt "tables".');
  }

  const rawTables = {} as RawTables;
  for (const table of BACKUP_TABLES) {
    const rows = (input.tables as RawRow)[table];
    if (rows === undefined) {
      rawTables[table] = [];
      continue;
    }
    if (!Array.isArray(rows)) {
      throw new BackupError(`Der Abschnitt "${table}" ist keine Liste.`);
    }
    rawTables[table] = rows.filter(isObject);
  }

  let raw: RawBackup = {
    schemaVersion: sourceVersion,
    exportedAt: str(input.exportedAt) ?? nowISO(),
    tables: rawTables,
  };

  while (raw.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[raw.schemaVersion];
    if (!step) {
      throw new BackupError(
        `Für Schema-Version ${raw.schemaVersion} gibt es keinen Migrationsschritt.`,
      );
    }
    raw = step(raw);
  }

  const problems: string[] = [];
  const tables: BackupTables = {
    transactions: validateTransactions(raw.tables.transactions, problems),
    categories: validateCategories(raw.tables.categories, problems),
    recurringRules: validateRecurringRules(raw.tables.recurringRules, problems),
    shoppingItems: validateShoppingItems(raw.tables.shoppingItems, problems),
    settings: validateSettings(raw.tables.settings, problems),
  };

  return {
    data: {
      app: BACKUP_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: raw.exportedAt,
      tables,
    },
    sourceVersion,
    migrated: sourceVersion !== SCHEMA_VERSION,
    problems,
  };
}

function validateTransactions(rows: RawRow[], problems: string[]): Transaction[] {
  const result: Transaction[] = [];
  let dropped = 0;
  for (const row of rows) {
    const id = str(row.id);
    const date = str(row.date);
    const amountCents = num(row.amountCents);
    const categoryId = str(row.categoryId);
    if (!id || !date || !isISODate(date) || amountCents === undefined || !categoryId) {
      dropped += 1;
      continue;
    }
    const source = row.source;
    const record: Transaction = {
      id,
      date,
      amountCents: Math.trunc(amountCents),
      categoryId,
      source:
        source === 'manual' || source === 'recurring' || source === 'shopping'
          ? source
          : 'manual',
      createdAt: str(row.createdAt) ?? nowISO(),
      updatedAt: str(row.updatedAt) ?? str(row.createdAt) ?? nowISO(),
    };
    const merchant = str(row.merchant);
    if (merchant) record.merchant = merchant;
    const note = str(row.note);
    if (note) record.note = note;
    const ruleId = str(row.recurringRuleId);
    if (ruleId) record.recurringRuleId = ruleId;
    result.push(record);
  }
  if (dropped > 0) {
    problems.push(`${dropped} Buchung(en) ohne gültige Pflichtfelder übersprungen.`);
  }
  return result;
}

function validateCategories(rows: RawRow[], problems: string[]): Category[] {
  const result: Category[] = [];
  let dropped = 0;
  for (const [index, row] of rows.entries()) {
    const id = str(row.id);
    const name = str(row.name);
    if (!id || !name) {
      dropped += 1;
      continue;
    }
    const record: Category = {
      id,
      name,
      color: str(row.color) ?? '#8a8f94',
      kind: row.kind === 'fix' ? 'fix' : 'variabel',
      archived: bool(row.archived, false),
      sortOrder: num(row.sortOrder) ?? index,
      usageCount: Math.max(0, Math.trunc(num(row.usageCount) ?? 0)),
    };
    const parentId = str(row.parentId);
    if (parentId) record.parentId = parentId;
    result.push(record);
  }
  if (dropped > 0) {
    problems.push(`${dropped} Kategorie(n) ohne Name oder ID übersprungen.`);
  }
  return result;
}

function validateRecurringRules(rows: RawRow[], problems: string[]): RecurringRule[] {
  const result: RecurringRule[] = [];
  let dropped = 0;
  for (const row of rows) {
    const id = str(row.id);
    const name = str(row.name);
    const categoryId = str(row.categoryId);
    const amountCents = num(row.amountCents);
    const startDate = str(row.startDate);
    if (!id || !name || !categoryId || amountCents === undefined || !startDate) {
      dropped += 1;
      continue;
    }
    const interval = row.interval;
    const record: RecurringRule = {
      id,
      name,
      categoryId,
      amountCents: Math.trunc(amountCents),
      interval:
        interval === 'monthly' || interval === 'quarterly' || interval === 'yearly'
          ? interval
          : 'monthly',
      dayOfMonth: Math.min(31, Math.max(1, Math.trunc(num(row.dayOfMonth) ?? 1))),
      startDate,
      autoPost: bool(row.autoPost, false),
      active: bool(row.active, true),
    };
    const endDate = str(row.endDate);
    if (endDate) record.endDate = endDate;
    const lastPosted = str(row.lastPostedDate);
    if (lastPosted) record.lastPostedDate = lastPosted;
    result.push(record);
  }
  if (dropped > 0) {
    problems.push(`${dropped} Fixkosten-Regel(n) übersprungen.`);
  }
  return result;
}

function validateShoppingItems(rows: RawRow[], problems: string[]): ShoppingItem[] {
  const result: ShoppingItem[] = [];
  let dropped = 0;
  for (const [index, row] of rows.entries()) {
    const id = str(row.id);
    const name = str(row.name);
    if (!id || !name) {
      dropped += 1;
      continue;
    }
    const record: ShoppingItem = {
      id,
      name,
      done: bool(row.done, false),
      isStaple: bool(row.isStaple, false),
      onList: bool(row.onList, true),
      addedAt: str(row.addedAt) ?? nowISO(),
      sortOrder: num(row.sortOrder) ?? index,
    };
    const quantity = str(row.quantity);
    if (quantity) record.quantity = quantity;
    const doneAt = str(row.doneAt);
    if (doneAt) record.doneAt = doneAt;
    result.push(record);
  }
  if (dropped > 0) {
    problems.push(`${dropped} Eintrag/Einträge der Einkaufsliste übersprungen.`);
  }
  return result;
}

function validateSettings(rows: RawRow[], problems: string[]): SettingEntry[] {
  const result: SettingEntry[] = [];
  let dropped = 0;
  for (const row of rows) {
    const key = str(row.key);
    if (!key) {
      dropped += 1;
      continue;
    }
    result.push({ key, value: row.value ?? null });
  }
  if (dropped > 0) {
    problems.push(`${dropped} Einstellung(en) ohne Schlüssel übersprungen.`);
  }
  return result;
}
