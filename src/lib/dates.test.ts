import { describe, expect, it } from 'vitest';
import {
  addMonthsToDate,
  addMonthsToKey,
  daysBetween,
  fileStamp,
  formatMonthLabel,
  fromISODate,
  isISODate,
  monthEnd,
  monthKeyOf,
  monthStart,
  monthsBackFrom,
  todayISO,
  toISODate,
} from './dates';

describe('lokale Datumsgrenzen', () => {
  it('verschiebt späte Uhrzeiten nicht in den Folgetag', () => {
    // Mit toISOString() waere das je nach Zeitzone der 1. Februar gewesen.
    expect(toISODate(new Date(2026, 0, 31, 23, 59, 59))).toBe('2026-01-31');
    expect(toISODate(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
  });

  it('liest ISO-Strings als lokale Mitternacht', () => {
    const date = fromISODate('2026-01-31');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(31);
    expect(date.getHours()).toBe(0);
  });

  it('ist ein verlustfreier Rundlauf über Monats- und Jahresgrenzen', () => {
    for (const iso of ['2025-12-31', '2026-01-01', '2026-02-28', '2024-02-29', '2026-10-25']) {
      expect(toISODate(fromISODate(iso))).toBe(iso);
      expect(monthKeyOf(iso)).toBe(iso.slice(0, 7));
    }
  });

  it('überlebt die Sommerzeitumstellung', () => {
    // In Europa endet die Sommerzeit am letzten Sonntag im Oktober.
    expect(toISODate(new Date(2026, 9, 25, 2, 30))).toBe('2026-10-25');
    expect(daysBetween(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
  });

  it('erkennt gültige und ungültige ISO-Daten', () => {
    expect(isISODate('2026-01-31')).toBe(true);
    expect(isISODate('2024-02-29')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('26-01-01')).toBe(false);
    expect(isISODate('2026-1-1')).toBe(false);
    expect(isISODate('')).toBe(false);
    expect(isISODate(20260101)).toBe(false);
  });

  it('gibt heute im erwarteten Format aus', () => {
    expect(isISODate(todayISO())).toBe(true);
  });
});

describe('Monatsarithmetik', () => {
  it('bestimmt Monatsanfang und -ende', () => {
    expect(monthStart('2026-02')).toBe('2026-02-01');
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(monthEnd('2024-02')).toBe('2024-02-29');
    expect(monthEnd('2026-12')).toBe('2026-12-31');
    expect(monthEnd('2026-04')).toBe('2026-04-30');
  });

  it('rechnet über Jahresgrenzen', () => {
    expect(addMonthsToKey('2026-12', 1)).toBe('2027-01');
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToKey('2026-06', 12)).toBe('2027-06');
  });

  it('klemmt zu kurze Monate ab', () => {
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDate('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('findet den Anfang zurückliegender Monate', () => {
    expect(monthsBackFrom('2026-03-15', 2)).toBe('2026-01-01');
    expect(monthsBackFrom('2026-01-15', 1)).toBe('2025-12-01');
    expect(monthsBackFrom('2026-01-15', 0)).toBe('2026-01-01');
  });

  it('beschriftet Monate auf Deutsch', () => {
    expect(formatMonthLabel('2026-08')).toBe('August 2026');
    expect(formatMonthLabel('2026-03')).toBe('März 2026');
  });

  it('erzeugt sortierbare Dateinamen-Stempel', () => {
    expect(fileStamp(new Date(2026, 7, 18, 9, 5))).toBe('2026-08-18_0905');
  });
});
