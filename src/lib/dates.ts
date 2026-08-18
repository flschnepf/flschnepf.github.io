/**
 * Datumshilfen. Alle Datumsangaben der App sind ISO-Strings `YYYY-MM-DD` in
 * *lokaler* Zeit. Niemals `new Date('2026-01-31')` verwenden — das ist UTC und
 * schiebt Buchungen ueber Monatsgrenzen. Deshalb ausschliesslich `parseISO`
 * (lokal) bzw. die Funktionen hier.
 */
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';

/** `YYYY-MM-DD`, lokale Zeit. */
export type ISODate = string;
/** `YYYY-MM`, lokale Zeit. */
export type MonthKey = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = parseISO(value);
  return !Number.isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === value;
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && MONTH_KEY.test(value);
}

/** Lokales Datum -> ISO-String. */
export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

/** ISO-String -> lokale Mitternacht. */
export function fromISODate(iso: ISODate): Date {
  return parseISO(iso);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(todayISO());
}

export function monthStart(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function monthEnd(month: MonthKey): ISODate {
  return toISODate(endOfMonth(parseISO(monthStart(month))));
}

export function addMonthsToKey(month: MonthKey, delta: number): MonthKey {
  return monthKeyOf(toISODate(addMonths(parseISO(monthStart(month)), delta)));
}

export function addMonthsToDate(iso: ISODate, delta: number): ISODate {
  return toISODate(addMonths(parseISO(iso), delta));
}

export function startOfMonthISO(iso: ISODate): ISODate {
  return toISODate(startOfMonth(parseISO(iso)));
}

export function monthsBackFrom(iso: ISODate, months: number): ISODate {
  return toISODate(startOfMonth(subMonths(parseISO(iso), months)));
}

/** Ganze Kalendertage zwischen zwei Zeitpunkten (positiv, wenn `later` spaeter ist). */
export function daysBetween(earlier: Date, later: Date): number {
  return differenceInCalendarDays(later, earlier);
}

export function formatDayShort(iso: ISODate): string {
  return format(parseISO(iso), 'dd.MM.', { locale: de });
}

export function formatDayLong(iso: ISODate): string {
  return format(parseISO(iso), 'EEEEEE, d. MMM yyyy', { locale: de });
}

export function formatMonthLabel(month: MonthKey): string {
  return format(parseISO(monthStart(month)), 'MMMM yyyy', { locale: de });
}

export function formatTimestamp(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd.MM.yyyy, HH:mm', { locale: de });
}

/** Dateinamens-Stempel: `2026-08-18_0930`. */
export function fileStamp(date = new Date()): string {
  return format(date, "yyyy-MM-dd'_'HHmm");
}
