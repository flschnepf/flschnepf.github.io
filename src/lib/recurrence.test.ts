import { describe, expect, it } from 'vitest';
import type { RecurringRule } from '../db/types';
import {
  dueDates,
  nextDueDate,
  nextOccurrenceAfter,
  occurrenceAt,
  occurrencesUpTo,
  type RecurrenceSpec,
} from './recurrence';

function spec(overrides: Partial<RecurrenceSpec> = {}): RecurrenceSpec {
  return {
    interval: 'monthly',
    dayOfMonth: 1,
    startDate: '2026-01-01',
    ...overrides,
  };
}

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'r1',
    name: 'Miete',
    categoryId: 'c1',
    amountCents: 85000,
    interval: 'monthly',
    dayOfMonth: 1,
    startDate: '2026-01-01',
    autoPost: false,
    active: true,
    ...overrides,
  };
}

describe('Termine berechnen', () => {
  it('zählt monatlich hoch', () => {
    const s = spec();
    expect([0, 1, 2].map((index) => occurrenceAt(s, index))).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('klemmt den Tag auf die Monatslänge', () => {
    const s = spec({ dayOfMonth: 31, startDate: '2026-01-31' });
    expect([0, 1, 2, 3].map((index) => occurrenceAt(s, index))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    // Schaltjahr
    expect(occurrenceAt(spec({ dayOfMonth: 31, startDate: '2024-01-31' }), 1)).toBe(
      '2024-02-29',
    );
  });

  it('hängt den Quartalsrhythmus am Startmonat auf', () => {
    const s = spec({ interval: 'quarterly', dayOfMonth: 15, startDate: '2026-02-15' });
    expect([0, 1, 2, 3, 4].map((index) => occurrenceAt(s, index))).toEqual([
      '2026-02-15',
      '2026-05-15',
      '2026-08-15',
      '2026-11-15',
      '2027-02-15',
    ]);
  });

  it('rechnet jährlich über Jahresgrenzen', () => {
    const s = spec({ interval: 'yearly', dayOfMonth: 20, startDate: '2025-12-20' });
    expect([0, 1, 2].map((index) => occurrenceAt(s, index))).toEqual([
      '2025-12-20',
      '2026-12-20',
      '2027-12-20',
    ]);
  });

  it('lässt Termine vor dem Startdatum aus', () => {
    // Start am 15., gebucht wird aber am 1. — der erste Termin ist der Folgemonat.
    const s = spec({ dayOfMonth: 1, startDate: '2026-01-15' });
    expect(occurrencesUpTo(s, '2026-03-31')).toEqual(['2026-02-01', '2026-03-01']);
  });

  it('endet mit dem Enddatum', () => {
    const s = spec({ endDate: '2026-03-15' });
    expect(occurrencesUpTo(s, '2026-12-31')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('liefert nichts, solange das Startdatum in der Zukunft liegt', () => {
    expect(occurrencesUpTo(spec({ startDate: '2027-01-01' }), '2026-08-18')).toEqual([]);
  });

  it('findet den nächsten Termin', () => {
    expect(nextOccurrenceAfter(spec(), '2026-08-18')).toBe('2026-09-01');
    expect(nextOccurrenceAfter(spec({ endDate: '2026-08-31' }), '2026-08-18')).toBeNull();
  });
});

describe('Fälligkeit und Idempotenz', () => {
  it('holt verpasste Monate nach', () => {
    expect(dueDates(rule(), '2026-03-15')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('bucht nichts doppelt, egal wie oft die App startet', () => {
    const posted = rule({ lastPostedDate: '2026-03-01' });
    expect(dueDates(posted, '2026-03-15')).toEqual([]);
    expect(dueDates(posted, '2026-03-31')).toEqual([]);
    // Erst der nächste Termin ist wieder fällig.
    expect(dueDates(posted, '2026-04-01')).toEqual(['2026-04-01']);
    expect(dueDates({ ...posted, lastPostedDate: '2026-04-01' }, '2026-04-01')).toEqual([]);
  });

  it('ignoriert inaktive Regeln', () => {
    expect(dueDates(rule({ active: false }), '2026-06-01')).toEqual([]);
    expect(nextDueDate(rule({ active: false }), '2026-06-01')).toBeNull();
  });

  it('wird am Fälligkeitstag selbst fällig, nicht davor', () => {
    const r = rule({ dayOfMonth: 15, startDate: '2026-08-15' });
    expect(dueDates(r, '2026-08-14')).toEqual([]);
    expect(dueDates(r, '2026-08-15')).toEqual(['2026-08-15']);
  });

  it('zeigt den nächsten Termin auch nach dem Buchen an', () => {
    expect(nextDueDate(rule({ lastPostedDate: '2026-08-01' }), '2026-08-18')).toBe(
      '2026-09-01',
    );
    expect(nextDueDate(rule({ interval: 'yearly' }), '2026-08-18')).toBe('2027-01-01');
  });

  it('hört nach dem Enddatum auf, fällig zu werden', () => {
    const r = rule({ endDate: '2026-02-28', lastPostedDate: '2026-02-01' });
    expect(dueDates(r, '2026-12-31')).toEqual([]);
    expect(nextDueDate(r, '2026-12-31')).toBeNull();
  });
});
