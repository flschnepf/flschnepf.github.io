import type { ISODate } from '../lib/dates';
import { todayISO } from '../lib/dates';
import { newId } from '../lib/ids';
import { dueDates, nextDueDate } from '../lib/recurrence';
import { db as defaultDb, type KostenDB } from './db';
import { createTransaction } from './transactions';
import type { RecurringRule, Transaction } from './types';

export interface NewRuleInput {
  name: string;
  categoryId: string;
  amountCents: number;
  interval: RecurringRule['interval'];
  dayOfMonth: number;
  startDate: ISODate;
  endDate?: ISODate;
  autoPost: boolean;
}

export type RulePatch = Partial<NewRuleInput & Pick<RecurringRule, 'active'>>;

export async function listRules(database: KostenDB = defaultDb): Promise<RecurringRule[]> {
  const rows = await database.recurringRules.toArray();
  return rows.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'de'),
  );
}

export async function createRule(
  input: NewRuleInput,
  database: KostenDB = defaultDb,
): Promise<RecurringRule> {
  const rule: RecurringRule = {
    id: newId(),
    name: input.name.trim(),
    categoryId: input.categoryId,
    amountCents: Math.trunc(input.amountCents),
    interval: input.interval,
    dayOfMonth: Math.min(31, Math.max(1, Math.trunc(input.dayOfMonth))),
    startDate: input.startDate,
    autoPost: input.autoPost,
    active: true,
  };
  if (input.endDate) rule.endDate = input.endDate;
  await database.recurringRules.add(rule);
  return rule;
}

export async function updateRule(
  id: string,
  patch: RulePatch,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.recurringRules, async () => {
    const existing = await database.recurringRules.get(id);
    if (!existing) return;
    const next: RecurringRule = { ...existing };
    if (patch.name !== undefined) next.name = patch.name.trim();
    if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
    if (patch.amountCents !== undefined) next.amountCents = Math.trunc(patch.amountCents);
    if (patch.interval !== undefined) next.interval = patch.interval;
    if (patch.dayOfMonth !== undefined) {
      next.dayOfMonth = Math.min(31, Math.max(1, Math.trunc(patch.dayOfMonth)));
    }
    if (patch.startDate !== undefined) next.startDate = patch.startDate;
    if (patch.endDate !== undefined) {
      if (patch.endDate) next.endDate = patch.endDate;
      else delete next.endDate;
    }
    if (patch.autoPost !== undefined) next.autoPost = patch.autoPost;
    if (patch.active !== undefined) next.active = patch.active;
    await database.recurringRules.put(next);
  });
}

export async function setRuleActive(
  id: string,
  active: boolean,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.recurringRules.update(id, { active });
}

/**
 * Regeln duerfen geloescht werden — anders als Kategorien haengt daran keine
 * Anzeige: Buchungen behalten ihre `recurringRuleId`, brauchen sie aber nicht.
 */
export async function deleteRule(
  id: string,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.recurringRules.delete(id);
}

export interface DueEntry {
  rule: RecurringRule;
  date: ISODate;
}

/** Offene Faelligkeiten aus bereits geladenen Regeln, aelteste zuerst. */
export function dueEntries(rules: RecurringRule[], today: ISODate = todayISO()): DueEntry[] {
  const entries: DueEntry[] = [];
  for (const rule of rules) {
    for (const date of dueDates(rule, today)) {
      entries.push({ rule, date });
    }
  }
  return entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.rule.name.localeCompare(b.rule.name, 'de');
  });
}

/** Dasselbe, aber frisch aus der Datenbank. */
export async function collectDue(
  today: ISODate = todayISO(),
  database: KostenDB = defaultDb,
): Promise<DueEntry[]> {
  return dueEntries(await database.recurringRules.toArray(), today);
}

export function nextDueFor(rule: RecurringRule, today: ISODate = todayISO()): ISODate | null {
  return nextDueDate(rule, today);
}

async function advanceLastPosted(
  database: KostenDB,
  ruleId: string,
  date: ISODate,
): Promise<void> {
  const rule = await database.recurringRules.get(ruleId);
  if (!rule) return;
  if (!rule.lastPostedDate || rule.lastPostedDate < date) {
    await database.recurringRules.update(ruleId, { lastPostedDate: date });
  }
}

/**
 * Bucht einen faelligen Termin. Der Doppelbuchungsschutz haengt nicht allein an
 * `lastPostedDate`: Existiert fuer Regel und Datum schon eine Buchung, wird nur
 * der Zeiger nachgezogen. Das haelt auch dann, wenn ein Backup von einem anderen
 * Stand eingespielt wurde. Pruefung und Schreiben liegen in *einer* Transaktion,
 * sonst kaeme ein doppelter App-Start dazwischen.
 */
export async function postDue(
  entry: DueEntry,
  database: KostenDB = defaultDb,
): Promise<Transaction | null> {
  return database.transaction(
    'rw',
    database.transactions,
    database.categories,
    database.recurringRules,
    async () => {
      const duplicate = await database.transactions
        .where('recurringRuleId')
        .equals(entry.rule.id)
        .filter((transaction) => transaction.date === entry.date)
        .first();

      if (duplicate) {
        await advanceLastPosted(database, entry.rule.id, entry.date);
        return null;
      }

      const transaction = await createTransaction(
        {
          date: entry.date,
          amountCents: entry.rule.amountCents,
          categoryId: entry.rule.categoryId,
          note: entry.rule.name,
          source: 'recurring',
          recurringRuleId: entry.rule.id,
        },
        database,
      );
      await advanceLastPosted(database, entry.rule.id, entry.date);
      return transaction;
    },
  );
}

/** Termin abhaken, ohne zu buchen — etwa wenn eine Rechnung ausgefallen ist. */
export async function skipDue(
  entry: DueEntry,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.recurringRules, async () => {
    await advanceLastPosted(database, entry.rule.id, entry.date);
  });
}

export async function postAllDue(
  entries: DueEntry[],
  database: KostenDB = defaultDb,
): Promise<number> {
  let posted = 0;
  for (const entry of entries) {
    const transaction = await postDue(entry, database);
    if (transaction) posted += 1;
  }
  return posted;
}

/**
 * Beim App-Start: Regeln mit `autoPost` direkt buchen. Alles andere landet in
 * der Bestaetigungsliste auf dem Fixkosten-Screen.
 */
export async function runAutoPost(
  today: ISODate = todayISO(),
  database: KostenDB = defaultDb,
): Promise<number> {
  const due = (await collectDue(today, database)).filter((entry) => entry.rule.autoPost);
  return postAllDue(due, database);
}

let autoPostRun: Promise<number> | null = null;

/**
 * Genau einmal pro App-Sitzung. React fuehrt Effekte im StrictMode doppelt aus —
 * die Transaktion in `postDue` faengt das zwar ab, aber der zweite Lauf ist
 * schlicht ueberfluessig.
 */
export function runAutoPostOnce(database: KostenDB = defaultDb): Promise<number> {
  autoPostRun ??= runAutoPost(todayISO(), database).catch((error: unknown) => {
    console.error('Automatisches Buchen fehlgeschlagen', error);
    return 0;
  });
  return autoPostRun;
}
