import { db as defaultDb, SCHEMA_VERSION, type KostenDB } from '../db/db';
import { setSetting } from '../db/settings';
import { fileStamp } from '../lib/dates';
import { nowISO } from '../lib/ids';
import { BACKUP_APP_ID, type BackupFile } from './schema';

/** Liest alle Tabellen in einer Lesetransaktion — konsistenter Schnappschuss. */
export async function buildBackup(database: KostenDB = defaultDb): Promise<BackupFile> {
  const [transactions, categories, recurringRules, shoppingItems, settings] =
    await database.transaction(
      'r',
      database.transactions,
      database.categories,
      database.recurringRules,
      database.shoppingItems,
      database.settings,
      () =>
        Promise.all([
          database.transactions.toArray(),
          database.categories.toArray(),
          database.recurringRules.toArray(),
          database.shoppingItems.toArray(),
          database.settings.toArray(),
        ]),
    );

  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    tables: { transactions, categories, recurringRules, shoppingItems, settings },
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(date = new Date()): string {
  return `kostentracker_${fileStamp(date)}.json`;
}

export function csvFilename(date = new Date()): string {
  return `kostentracker_buchungen_${fileStamp(date)}.csv`;
}

/** Nur nach einem Voll-Export setzen — davon haengt das Backup-Banner ab. */
export async function markExported(database: KostenDB = defaultDb): Promise<string> {
  const timestamp = nowISO();
  await setSetting('lastExportAt', timestamp, database);
  return timestamp;
}
