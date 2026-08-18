import type { Category, Transaction } from '../db/types';
import { addMonthsToKey, monthKeyOf, type MonthKey } from './dates';

/**
 * Aggregation fuer die Auswertung. Reine Funktionen ueber Cent-Werte, damit sie
 * ohne Datenbank und ohne Chart.js testbar sind.
 *
 * Grundregel: Monatsreihen sind immer luechenlos. Ein Monat ohne Buchungen ist
 * eine 0 und faellt nicht aus der Reihe — sonst luegen die Achsen.
 */

export interface AnalyticsIndex {
  /** Summe je Monat. */
  totals: Map<MonthKey, number>;
  /** Summe je Monat und Kategorie. */
  byCategory: Map<MonthKey, Map<string, number>>;
  /** Fruehester und spaetester Monat mit Buchungen. */
  firstMonth: MonthKey | null;
  lastMonth: MonthKey | null;
}

export function buildIndex(transactions: Transaction[]): AnalyticsIndex {
  const totals = new Map<MonthKey, number>();
  const byCategory = new Map<MonthKey, Map<string, number>>();
  let firstMonth: MonthKey | null = null;
  let lastMonth: MonthKey | null = null;

  for (const transaction of transactions) {
    const month = monthKeyOf(transaction.date);
    totals.set(month, (totals.get(month) ?? 0) + transaction.amountCents);

    let categories = byCategory.get(month);
    if (!categories) {
      categories = new Map<string, number>();
      byCategory.set(month, categories);
    }
    categories.set(
      transaction.categoryId,
      (categories.get(transaction.categoryId) ?? 0) + transaction.amountCents,
    );

    if (firstMonth === null || month < firstMonth) firstMonth = month;
    if (lastMonth === null || month > lastMonth) lastMonth = month;
  }

  return { totals, byCategory, firstMonth, lastMonth };
}

/** Lueckenlose Monatsliste, Grenzen inklusive. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  if (from > to) return [];
  const months: MonthKey[] = [];
  let current = from;
  while (current <= to) {
    months.push(current);
    current = addMonthsToKey(current, 1);
  }
  return months;
}

/** Die letzten `count` Monate bis einschliesslich `endMonth`. */
export function lastMonths(endMonth: MonthKey, count: number): MonthKey[] {
  if (count <= 0) return [];
  return monthRange(addMonthsToKey(endMonth, -(count - 1)), endMonth);
}

export function totalFor(index: AnalyticsIndex, month: MonthKey): number {
  return index.totals.get(month) ?? 0;
}

export function totalsFor(index: AnalyticsIndex, months: MonthKey[]): number[] {
  return months.map((month) => totalFor(index, month));
}

export function categoryTotalsFor(
  index: AnalyticsIndex,
  months: MonthKey[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const month of months) {
    const categories = index.byCategory.get(month);
    if (!categories) continue;
    for (const [categoryId, cents] of categories) {
      result.set(categoryId, (result.get(categoryId) ?? 0) + cents);
    }
  }
  return result;
}

export interface MonthlySummary {
  month: MonthKey;
  totalCents: number;
  /** Vormonat, auch wenn dort nichts gebucht wurde. */
  previousCents: number;
  deltaPreviousCents: number;
  /**
   * Durchschnitt der *drei vorangehenden* Monate. Der aktuelle Monat bleibt
   * aussen vor, sonst vergleicht er sich mit sich selbst.
   */
  averageThreeCents: number;
  deltaAverageCents: number;
}

export function monthlySummary(index: AnalyticsIndex, month: MonthKey): MonthlySummary {
  const totalCents = totalFor(index, month);
  const previousCents = totalFor(index, addMonthsToKey(month, -1));
  const previousThree = [1, 2, 3].map((offset) =>
    totalFor(index, addMonthsToKey(month, -offset)),
  );
  const averageThreeCents = Math.round(
    previousThree.reduce((sum, value) => sum + value, 0) / previousThree.length,
  );

  return {
    month,
    totalCents,
    previousCents,
    deltaPreviousCents: totalCents - previousCents,
    averageThreeCents,
    deltaAverageCents: totalCents - averageThreeCents,
  };
}

export interface CategorySeries {
  categoryId: string;
  name: string;
  color: string;
  values: number[];
  totalCents: number;
}

/**
 * Eine Reihe je Kategorie fuer die gestapelten Balken. Kategorien ohne jede
 * Buchung im Zeitraum fallen raus — sonst erschlaegt die Legende das Diagramm.
 */
export function categorySeriesFor(
  index: AnalyticsIndex,
  months: MonthKey[],
  categories: Category[],
): CategorySeries[] {
  const series: CategorySeries[] = [];
  for (const category of categories) {
    const values = months.map(
      (month) => index.byCategory.get(month)?.get(category.id) ?? 0,
    );
    const totalCents = values.reduce((sum, value) => sum + value, 0);
    if (values.every((value) => value === 0)) continue;
    series.push({
      categoryId: category.id,
      name: category.name,
      color: category.color,
      values,
      totalCents,
    });
  }
  return series.sort((a, b) => b.totalCents - a.totalCents);
}

export interface ShareSlice {
  categoryId: string;
  name: string;
  color: string;
  cents: number;
  share: number;
}

/**
 * Anteile fuer den Donut. Kategorien mit negativer Nettosumme (mehr Erstattung
 * als Ausgabe) haben in einem Kreisdiagramm keine sinnvolle Flaeche und werden
 * ausgelassen — die Rueckgabe sagt, wie viele das waren.
 */
export function categoryShares(
  index: AnalyticsIndex,
  months: MonthKey[],
  categories: Category[],
): { slices: ShareSlice[]; omitted: number; totalCents: number } {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const totals = categoryTotalsFor(index, months);

  const positive: Array<{ categoryId: string; cents: number }> = [];
  let omitted = 0;
  for (const [categoryId, cents] of totals) {
    if (cents > 0) positive.push({ categoryId, cents });
    else if (cents < 0) omitted += 1;
  }

  const totalCents = positive.reduce((sum, entry) => sum + entry.cents, 0);
  const slices = positive
    .map((entry) => {
      const category = byId.get(entry.categoryId);
      return {
        categoryId: entry.categoryId,
        name: category?.name ?? 'Unbekannt',
        color: category?.color ?? '#8a8f94',
        cents: entry.cents,
        share: totalCents === 0 ? 0 : entry.cents / totalCents,
      };
    })
    .sort((a, b) => b.cents - a.cents);

  return { slices, omitted, totalCents };
}

/** Fixkosten gegen variable Kosten, je Monat. */
export function fixVariableSeries(
  index: AnalyticsIndex,
  months: MonthKey[],
  categories: Category[],
): { fix: number[]; variable: number[] } {
  const kindOf = new Map(categories.map((category) => [category.id, category.kind]));
  const fix = months.map(() => 0);
  const variable = months.map(() => 0);

  months.forEach((month, position) => {
    const byCategory = index.byCategory.get(month);
    if (!byCategory) return;
    for (const [categoryId, cents] of byCategory) {
      if (kindOf.get(categoryId) === 'fix') fix[position]! += cents;
      else variable[position]! += cents;
    }
  });

  return { fix, variable };
}

/**
 * Kumulierte Jahresausgaben, zwoelf Werte. Monate nach `upTo` sind `null` statt
 * 0 — eine kumulierte Linie faellt nicht auf null zurueck, nur weil das Jahr
 * noch laeuft.
 */
export function cumulativeYear(
  index: AnalyticsIndex,
  year: number,
  upTo?: MonthKey,
): Array<number | null> {
  const result: Array<number | null> = [];
  let running = 0;
  for (let month = 1; month <= 12; month += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (upTo && key > upTo) {
      result.push(null);
      continue;
    }
    running += totalFor(index, key);
    result.push(running);
  }
  return result;
}
