import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, formatCentsPlain, parseAmountToCents } from './money';

/** Intl setzt ein geschütztes Leerzeichen vor das €-Zeichen. */
function normalize(value: string): string {
  return value.replace(/\u00a0|\u202f/g, ' ');
}

describe('parseAmountToCents', () => {
  it('liest Komma als Dezimaltrenner', () => {
    expect(parseAmountToCents('12,34')).toBe(1234);
    expect(parseAmountToCents('0,99')).toBe(99);
    expect(parseAmountToCents(',5')).toBe(50);
    expect(parseAmountToCents('7,')).toBe(700);
  });

  it('liest Punkt als Dezimaltrenner', () => {
    expect(parseAmountToCents('12.34')).toBe(1234);
    expect(parseAmountToCents('1.2')).toBe(120);
    expect(parseAmountToCents('0.05')).toBe(5);
  });

  it('behandelt ganze Zahlen als Euro', () => {
    expect(parseAmountToCents('1234')).toBe(123400);
    expect(parseAmountToCents('0')).toBe(0);
  });

  it('erkennt Tausendertrenner', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123456);
    expect(parseAmountToCents('1,234.56')).toBe(123456);
    expect(parseAmountToCents('1.234.567,89')).toBe(123456789);
    // Einzelner Punkt mit genau drei Stellen: deutscher Tausenderpunkt.
    expect(parseAmountToCents('1.234')).toBe(123400);
  });

  it('versteht negative Beträge', () => {
    expect(parseAmountToCents('-12,34')).toBe(-1234);
    expect(parseAmountToCents('\u221212,34')).toBe(-1234);
    expect(parseAmountToCents('+12,34')).toBe(1234);
    expect(parseAmountToCents('-0,01')).toBe(-1);
  });

  it('rundet auf Cent', () => {
    expect(parseAmountToCents('12,345')).toBe(1235);
    expect(parseAmountToCents('12,344')).toBe(1234);
    expect(parseAmountToCents('-1,999')).toBe(-200);
  });

  it('ignoriert Leerzeichen und Währungszeichen', () => {
    expect(parseAmountToCents('  12,34 € ')).toBe(1234);
    expect(parseAmountToCents('12,34EUR')).toBe(1234);
    expect(parseAmountToCents('1 234,50')).toBe(123450);
  });

  it('lehnt Unsinn ab', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('   ')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents(',')).toBeNull();
    expect(parseAmountToCents('-')).toBeNull();
    expect(parseAmountToCents('12,3,4')).toBeNull();
    expect(parseAmountToCents('12.34.5')).toBeNull();
    expect(parseAmountToCents('12€34')).toBeNull();
    expect(parseAmountToCents('99999999999')).toBeNull();
  });

  it('liefert immer ganze Zahlen', () => {
    for (const input of ['0,1', '0,01', '99,995', '3,333']) {
      const cents = parseAmountToCents(input);
      expect(Number.isInteger(cents)).toBe(true);
    }
  });
});

describe('Formatierung', () => {
  it('formatiert mit Währung', () => {
    expect(normalize(formatCents(1234))).toBe('12,34 €');
    expect(normalize(formatCents(-1234))).toBe('-12,34 €');
    expect(normalize(formatCents(0))).toBe('0,00 €');
    expect(normalize(formatCents(123456789))).toBe('1.234.567,89 €');
  });

  it('formatiert ohne Währung', () => {
    expect(formatCentsPlain(1234)).toBe('12,34');
    expect(formatCentsPlain(5)).toBe('0,05');
  });

  it('erzeugt Eingabestrings ohne Gruppierung', () => {
    expect(centsToInput(1234)).toBe('12,34');
    expect(centsToInput(-1234)).toBe('12,34');
    expect(centsToInput(5)).toBe('0,05');
    expect(centsToInput(123456789)).toBe('1234567,89');
  });

  it('ist ein verlustfreier Rundlauf', () => {
    for (const cents of [0, 1, 99, 100, 12345, -6789]) {
      expect(parseAmountToCents(centsToInput(cents))).toBe(Math.abs(cents));
    }
  });
});
