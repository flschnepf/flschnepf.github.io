import { addMonths, getDaysInMonth, parseISO, setDate } from 'date-fns';
import type { RecurringInterval, RecurringRule } from '../db/types';
import { monthKeyOf, monthStart, toISODate, type ISODate } from './dates';

/**
 * Faelligkeitsrechnung fuer wiederkehrende Regeln. Reine Funktionen ueber ISO-
 * Datumsstrings — die lassen sich lexikografisch vergleichen, solange sie das
 * Format `YYYY-MM-DD` haben.
 */

const STEP_MONTHS: Record<RecurringInterval, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export const INTERVAL_LABELS: Record<RecurringInterval, string> = {
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  yearly: 'jährlich',
};

/** Reissleine gegen Endlosschleifen bei absurden Startdaten. */
const MAX_STEPS = 1200;

/** Die fuer die Rechnung noetigen Felder — erlaubt Tests ohne vollen Datensatz. */
export type RecurrenceSpec = Pick<
  RecurringRule,
  'interval' | 'dayOfMonth' | 'startDate' | 'endDate'
>;

/**
 * Datum der `index`-ten Wiederholung. Der Zyklus haengt am Monat des
 * Startdatums; der Tag wird auf die Monatslaenge geklemmt, damit der 31. im
 * Februar nicht in den Maerz rutscht.
 */
export function occurrenceAt(spec: RecurrenceSpec, index: number): ISODate {
  const anchor = parseISO(monthStart(monthKeyOf(spec.startDate)));
  const month = addMonths(anchor, index * STEP_MONTHS[spec.interval]);
  const day = Math.min(Math.max(1, spec.dayOfMonth), getDaysInMonth(month));
  return toISODate(setDate(month, day));
}

export interface OccurrenceOptions {
  /** Nur Termine echt nach diesem Datum. */
  after?: ISODate;
}

/** Alle Termine bis einschliesslich `until`, aufsteigend. */
export function occurrencesUpTo(
  spec: RecurrenceSpec,
  until: ISODate,
  options: OccurrenceOptions = {},
): ISODate[] {
  const result: ISODate[] = [];
  for (let index = 0; index < MAX_STEPS; index += 1) {
    const date = occurrenceAt(spec, index);
    if (date > until) break;
    if (spec.endDate && date > spec.endDate) break;
    // Der erste Termin des Startmonats kann vor dem Startdatum liegen.
    if (date < spec.startDate) continue;
    if (options.after && date <= options.after) continue;
    result.push(date);
  }
  return result;
}

/** Erster Termin echt nach `date`, oder null wenn die Regel ausgelaufen ist. */
export function nextOccurrenceAfter(spec: RecurrenceSpec, date: ISODate): ISODate | null {
  for (let index = 0; index < MAX_STEPS; index += 1) {
    const candidate = occurrenceAt(spec, index);
    if (spec.endDate && candidate > spec.endDate) return null;
    if (candidate < spec.startDate) continue;
    if (candidate > date) return candidate;
  }
  return null;
}

/**
 * Faellige Termine einer Regel: alles zwischen `lastPostedDate` und heute.
 * `lastPostedDate` ist der Idempotenz-Anker — was einmal gebucht ist, taucht
 * hier nie wieder auf, egal wie oft die App geoeffnet wird.
 */
export function dueDates(rule: RecurringRule, today: ISODate): ISODate[] {
  if (!rule.active) return [];
  const options: OccurrenceOptions = {};
  if (rule.lastPostedDate) options.after = rule.lastPostedDate;
  return occurrencesUpTo(rule, today, options);
}

/** Naechster Termin in der Zukunft — fuer die Anzeige in der Regelliste. */
export function nextDueDate(rule: RecurringRule, today: ISODate): ISODate | null {
  if (!rule.active) return null;
  const anchor =
    rule.lastPostedDate && rule.lastPostedDate > today ? rule.lastPostedDate : today;
  return nextOccurrenceAfter(rule, anchor);
}
