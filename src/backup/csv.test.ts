import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../db/types';
import { transactionsToCsv } from './csv';

const category: Category = {
  id: 'c1',
  name: 'Lebensmittel',
  color: '#4c9f70',
  kind: 'variabel',
  archived: false,
  sortOrder: 0,
  usageCount: 3,
};

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    date: '2026-08-18',
    amountCents: 4237,
    categoryId: 'c1',
    source: 'manual',
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-18T08:00:00.000Z',
    ...overrides,
  };
}

describe('CSV-Export', () => {
  it('schreibt Kopfzeile mit BOM und Semikolon', () => {
    const csv = transactionsToCsv([], [category]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1).split('\r\n')[0]).toBe(
      'Datum;Betrag;Kategorie;Art;Händler;Notiz;Quelle',
    );
  });

  it('nutzt deutsches Dezimalkomma ohne Tausenderpunkte', () => {
    const csv = transactionsToCsv(
      [tx({ amountCents: 123456789 }), tx({ id: 't2', amountCents: -1500 })],
      [category],
    );
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[1]?.split(';')[1]).toBe('1234567,89');
    expect(lines[2]?.split(';')[1]).toBe('-15,00');
  });

  it('maskiert Semikolon, Anführungszeichen und Zeilenumbrüche', () => {
    const csv = transactionsToCsv(
      [tx({ note: 'Obst; Gemüse', merchant: 'Karls "Hofladen"' })],
      [category],
    );
    const line = csv.slice(1).trimEnd().split('\r\n')[1] ?? '';
    expect(line).toContain('"Karls ""Hofladen"""');
    expect(line).toContain('"Obst; Gemüse"');
  });

  it('kommt mit unbekannter Kategorie zurecht', () => {
    const csv = transactionsToCsv([tx({ categoryId: 'weg' })], [category]);
    expect(csv).toContain('Unbekannt');
  });
});
