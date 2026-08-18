import type { ISODate } from '../lib/dates';

export type UUID = string;
/** ISO-Zeitstempel mit Uhrzeit (`createdAt`/`updatedAt`). */
export type Timestamp = string;

export type TransactionSource = 'manual' | 'recurring' | 'shopping';

export interface Transaction {
  id: UUID;
  date: ISODate;
  /** Positiv = Ausgabe, negativ = Erstattung/Gutschrift. Immer Cent. */
  amountCents: number;
  categoryId: UUID;
  merchant?: string;
  note?: string;
  source: TransactionSource;
  recurringRuleId?: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CategoryKind = 'fix' | 'variabel';

export interface Category {
  id: UUID;
  name: string;
  /** Eine Ebene Verschachtelung genuegt. */
  parentId?: UUID;
  color: string;
  kind: CategoryKind;
  /** Kategorien werden nie geloescht, nur archiviert. */
  archived: boolean;
  sortOrder: number;
  usageCount: number;
}

export type RecurringInterval = 'monthly' | 'quarterly' | 'yearly';

/** Ab Phase 3 in Benutzung; Tabelle existiert seit Schema v1. */
export interface RecurringRule {
  id: UUID;
  name: string;
  categoryId: UUID;
  amountCents: number;
  interval: RecurringInterval;
  dayOfMonth: number;
  startDate: ISODate;
  endDate?: ISODate;
  autoPost: boolean;
  lastPostedDate?: ISODate;
  active: boolean;
}

export interface ShoppingItem {
  id: UUID;
  name: string;
  quantity?: string;
  done: boolean;
  /** Wiederkehrender Artikel: bleibt nach dem Einkauf als Vorschlag bestehen. */
  isStaple: boolean;
  /**
   * Liegt der Artikel gerade auf der Einkaufsliste? Staples wechseln beim
   * Abschluss eines Einkaufs auf `false` und tauchen dann in der
   * Vorschlagsleiste auf, statt gelöscht zu werden. Ergänzung zum Datenmodell
   * der Spezifikation (Schema v2) — ohne dieses Feld lassen sich "auf der
   * Liste" und "nur Vorschlag" nicht unterscheiden.
   */
  onList: boolean;
  addedAt: Timestamp;
  doneAt?: Timestamp;
  sortOrder: number;
}

export interface SettingEntry {
  key: string;
  value: unknown;
}
