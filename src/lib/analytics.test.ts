import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../db/types';
import {
  buildIndex,
  categorySeriesFor,
  categoryShares,
  categoryTotalsFor,
  cumulativeYear,
  fixVariableSeries,
  lastMonths,
  monthRange,
  monthlySummary,
  totalsFor,
} from './analytics';

const CATEGORIES: Category[] = [
  {
    id: 'lebensmittel',
    name: 'Lebensmittel',
    color: '#4c9f70',
    kind: 'variabel',
    archived: false,
    sortOrder: 0,
    usageCount: 0,
  },
  {
    id: 'miete',
    name: 'Miete',
    color: '#c25b6b',
    kind: 'fix',
    archived: false,
    sortOrder: 1,
    usageCount: 0,
  },
  {
    id: 'strom',
    name: 'Strom',
    color: '#e0a33c',
    kind: 'fix',
    archived: false,
    sortOrder: 2,
    usageCount: 0,
  },
];

let counter = 0;
function tx(date: string, amountCents: number, categoryId: string): Transaction {
  counter += 1;
  return {
    id: `t${counter}`,
    date,
    amountCents,
    categoryId,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const SAMPLE: Transaction[] = [
  tx('2026-01-05', 5000, 'lebensmittel'),
  tx('2026-01-31', 85000, 'miete'),
  // Februar: keine Buchungen — die Lücke muss als 0 erscheinen.
  tx('2026-03-02', 7000, 'lebensmittel'),
  tx('2026-03-15', 85000, 'miete'),
  tx('2026-03-20', -1500, 'lebensmittel'),
  tx('2026-04-01', 9000, 'strom'),
];

describe('Monatsreihen', () => {
  it('erzeugt lückenlose Zeiträume', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(monthRange('2026-03', '2026-03')).toEqual(['2026-03']);
    expect(monthRange('2026-05', '2026-04')).toEqual([]);
  });

  it('zählt rückwärts über Jahresgrenzen', () => {
    expect(lastMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(lastMonths('2026-02', 0)).toEqual([]);
  });

  it('füllt Monate ohne Buchungen mit 0 statt sie auszulassen', () => {
    const index = buildIndex(SAMPLE);
    const months = monthRange('2026-01', '2026-05');
    expect(totalsFor(index, months)).toEqual([90000, 0, 90500, 9000, 0]);
    expect(months).toHaveLength(5);
  });

  it('kommt mit leerem Datenbestand zurecht', () => {
    const index = buildIndex([]);
    expect(index.firstMonth).toBeNull();
    expect(totalsFor(index, monthRange('2026-01', '2026-03'))).toEqual([0, 0, 0]);
    expect(categoryTotalsFor(index, ['2026-01']).size).toBe(0);
    expect(categorySeriesFor(index, ['2026-01'], CATEGORIES)).toEqual([]);
    expect(categoryShares(index, ['2026-01'], CATEGORIES)).toEqual({
      slices: [],
      omitted: 0,
      totalCents: 0,
    });
  });

  it('merkt sich den belegten Zeitraum', () => {
    const index = buildIndex(SAMPLE);
    expect(index.firstMonth).toBe('2026-01');
    expect(index.lastMonth).toBe('2026-04');
  });
});

describe('Monatsvergleich', () => {
  it('rechnet Delta zum Vormonat und zum Dreimonatsschnitt', () => {
    const index = buildIndex(SAMPLE);
    const summary = monthlySummary(index, '2026-04');

    expect(summary.totalCents).toBe(9000);
    expect(summary.previousCents).toBe(90500);
    expect(summary.deltaPreviousCents).toBe(-81500);
    // Januar 90000, Februar 0, März 90500 → Schnitt 60166,67 ct
    expect(summary.averageThreeCents).toBe(60167);
    expect(summary.deltaAverageCents).toBe(9000 - 60167);
  });

  it('bleibt bei leerem Bestand bei null', () => {
    const summary = monthlySummary(buildIndex([]), '2026-04');
    expect(summary).toMatchObject({
      totalCents: 0,
      previousCents: 0,
      deltaPreviousCents: 0,
      averageThreeCents: 0,
      deltaAverageCents: 0,
    });
  });
});

describe('Kategorien im Zeitverlauf', () => {
  it('liefert eine Reihe je genutzter Kategorie, größte zuerst', () => {
    const index = buildIndex(SAMPLE);
    const months = monthRange('2026-01', '2026-04');
    const series = categorySeriesFor(index, months, CATEGORIES);

    // Sortiert nach Gesamtsumme: Miete 1700, Lebensmittel 105, Strom 90 Euro.
    expect(series.map((entry) => entry.name)).toEqual(['Miete', 'Lebensmittel', 'Strom']);
    expect(series[0]?.values).toEqual([85000, 0, 85000, 0]);
    expect(series[1]?.values).toEqual([5000, 0, 5500, 0]);
    expect(series[2]?.values).toEqual([0, 0, 0, 9000]);
    expect(series[0]?.color).toBe('#c25b6b');
  });

  it('lässt Kategorien ohne Buchung im Zeitraum weg', () => {
    const index = buildIndex(SAMPLE);
    const series = categorySeriesFor(index, ['2026-04'], CATEGORIES);
    expect(series.map((entry) => entry.name)).toEqual(['Strom']);
  });

  it('trennt fixe von variablen Kosten', () => {
    const index = buildIndex(SAMPLE);
    const months = monthRange('2026-01', '2026-04');
    expect(fixVariableSeries(index, months, CATEGORIES)).toEqual({
      fix: [85000, 0, 85000, 9000],
      variable: [5000, 0, 5500, 0],
    });
  });

  it('zählt unbekannte Kategorien zu den variablen Kosten', () => {
    const index = buildIndex([tx('2026-01-10', 1000, 'geloescht')]);
    expect(fixVariableSeries(index, ['2026-01'], CATEGORIES)).toEqual({
      fix: [0],
      variable: [1000],
    });
  });
});

describe('Anteile für den Donut', () => {
  it('berechnet Anteile und sortiert absteigend', () => {
    const index = buildIndex(SAMPLE);
    const { slices, totalCents, omitted } = categoryShares(index, ['2026-03'], CATEGORIES);

    expect(totalCents).toBe(90500);
    expect(omitted).toBe(0);
    expect(slices.map((slice) => slice.name)).toEqual(['Miete', 'Lebensmittel']);
    expect(slices[0]?.cents).toBe(85000);
    expect(slices[0]?.share).toBeCloseTo(85000 / 90500, 6);
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1, 6);
  });

  it('lässt negative Nettosummen aus, statt sie zu verzeichnen', () => {
    const index = buildIndex([
      tx('2026-05-01', 3000, 'miete'),
      tx('2026-05-02', -2000, 'lebensmittel'),
    ]);
    const { slices, omitted, totalCents } = categoryShares(index, ['2026-05'], CATEGORIES);
    expect(slices.map((slice) => slice.name)).toEqual(['Miete']);
    expect(omitted).toBe(1);
    expect(totalCents).toBe(3000);
  });

  it('nennt gelöschte Kategorien beim Namen', () => {
    const index = buildIndex([tx('2026-05-01', 3000, 'weg')]);
    const { slices } = categoryShares(index, ['2026-05'], CATEGORIES);
    expect(slices[0]?.name).toBe('Unbekannt');
  });
});

describe('Kumulierte Jahresausgaben', () => {
  it('summiert über zwölf Monate auf', () => {
    const index = buildIndex(SAMPLE);
    expect(cumulativeYear(index, 2026)).toEqual([
      90000, 90000, 180500, 189500, 189500, 189500, 189500, 189500, 189500, 189500,
      189500, 189500,
    ]);
  });

  it('bricht das laufende Jahr ab, statt auf null zu fallen', () => {
    const index = buildIndex(SAMPLE);
    const values = cumulativeYear(index, 2026, '2026-04');
    expect(values.slice(0, 4)).toEqual([90000, 90000, 180500, 189500]);
    expect(values.slice(4)).toEqual([null, null, null, null, null, null, null, null]);
  });

  it('liefert für ein Jahr ohne Buchungen zwölf Nullen', () => {
    expect(cumulativeYear(buildIndex(SAMPLE), 2025)).toEqual(new Array(12).fill(0));
  });
});
