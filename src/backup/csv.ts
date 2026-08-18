import type { Category, Transaction } from '../db/types';
import { centsToInput } from '../lib/money';

const SEPARATOR = ';';
const NEWLINE = '\r\n';

const HEADER = ['Datum', 'Betrag', 'Kategorie', 'Art', 'Händler', 'Notiz', 'Quelle'];

function escapeField(value: string): string {
  if (/[";\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Deutsches Dezimalkomma, keine Tausenderpunkte — sonst stolpert Excel. */
function csvAmount(cents: number): string {
  return `${cents < 0 ? '-' : ''}${centsToInput(cents)}`;
}

/**
 * Semikolongetrennt mit BOM, damit Excel die Umlaute richtig liest.
 * Reiner Export — der Import laeuft ueber die JSON-Datei.
 */
export function transactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
): string {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const lines = [HEADER.join(SEPARATOR)];

  for (const transaction of transactions) {
    const category = byId.get(transaction.categoryId);
    lines.push(
      [
        transaction.date,
        csvAmount(transaction.amountCents),
        category?.name ?? 'Unbekannt',
        category?.kind ?? '',
        transaction.merchant ?? '',
        transaction.note ?? '',
        transaction.source,
      ]
        .map(escapeField)
        .join(SEPARATOR),
    );
  }

  return `\uFEFF${lines.join(NEWLINE)}${NEWLINE}`;
}
