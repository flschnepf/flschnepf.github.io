import type {
  Category,
  RecurringRule,
  SettingEntry,
  ShoppingItem,
  Transaction,
} from '../db/types';

export const BACKUP_TABLES = [
  'transactions',
  'categories',
  'recurringRules',
  'shoppingItems',
  'settings',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export interface BackupTables {
  transactions: Transaction[];
  categories: Category[];
  recurringRules: RecurringRule[];
  shoppingItems: ShoppingItem[];
  settings: SettingEntry[];
}

/** Format der Export-Datei. `app` dient als Plausibilitaetscheck beim Import. */
export interface BackupFile {
  app: 'kostentracker';
  schemaVersion: number;
  exportedAt: string;
  tables: BackupTables;
}

export const BACKUP_APP_ID = 'kostentracker';
