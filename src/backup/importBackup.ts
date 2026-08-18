import { db as defaultDb, type KostenDB } from '../db/db';
import { BACKUP_TABLES, type BackupFile, type BackupTableName } from './schema';

export type ImportMode = 'merge' | 'replace';

export interface TablePreview {
  table: BackupTableName;
  label: string;
  /** Datensaetze in der Datei. */
  incoming: number;
  /** Datensaetze aktuell in der Datenbank. */
  existing: number;
  /** Kommen neu dazu (ID unbekannt). */
  added: number;
  /** Vorhandene IDs, die beim Zusammenführen überschrieben werden. */
  overwritten: number;
}

export interface ImportPreview {
  rows: TablePreview[];
  totalIncoming: number;
  totalExisting: number;
}

const LABELS: Record<BackupTableName, string> = {
  transactions: 'Buchungen',
  categories: 'Kategorien',
  recurringRules: 'Fixkosten-Regeln',
  shoppingItems: 'Einkaufsliste',
  settings: 'Einstellungen',
};

function primaryKeyOf(table: BackupTableName, row: unknown): string {
  const record = row as Record<string, unknown>;
  return String(table === 'settings' ? record.key : record.id);
}

/**
 * Zaehlt, was ein Import anrichten wuerde. Bewusst vor der Bestaetigung, ohne
 * irgendetwas zu schreiben.
 */
export async function previewImport(
  backup: BackupFile,
  database: KostenDB = defaultDb,
): Promise<ImportPreview> {
  const rows: TablePreview[] = [];

  for (const table of BACKUP_TABLES) {
    const incoming = backup.tables[table] as unknown[];
    const existingKeys = new Set(
      (await database.table(table).toCollection().primaryKeys()).map(String),
    );
    let overwritten = 0;
    const seen = new Set<string>();
    for (const row of incoming) {
      const key = primaryKeyOf(table, row);
      if (seen.has(key)) continue;
      seen.add(key);
      if (existingKeys.has(key)) overwritten += 1;
    }
    rows.push({
      table,
      label: LABELS[table],
      incoming: incoming.length,
      existing: existingKeys.size,
      added: seen.size - overwritten,
      overwritten,
    });
  }

  return {
    rows,
    totalIncoming: rows.reduce((sum, row) => sum + row.incoming, 0),
    totalExisting: rows.reduce((sum, row) => sum + row.existing, 0),
  };
}

/**
 * Schreibt den Import in einer einzigen Transaktion ueber alle Tabellen —
 * entweder ganz oder gar nicht. Innerhalb der Transaktion laufen ausschliesslich
 * Dexie-Operationen, sonst bricht WebKit sie ab.
 */
export async function applyImport(
  backup: BackupFile,
  mode: ImportMode,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.transaction(
    'rw',
    database.transactions,
    database.categories,
    database.recurringRules,
    database.shoppingItems,
    database.settings,
    async () => {
      for (const table of BACKUP_TABLES) {
        const target = database.table(table);
        if (mode === 'replace') {
          await target.clear();
        }
        const rows = backup.tables[table] as unknown[];
        if (rows.length > 0) {
          await target.bulkPut(rows);
        }
      }
    },
  );
}
