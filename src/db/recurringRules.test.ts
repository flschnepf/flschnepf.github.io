import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type KostenDB } from './db';
import {
  collectDue,
  createRule,
  deleteRule,
  listRules,
  nextDueFor,
  postAllDue,
  postDue,
  runAutoPost,
  setRuleActive,
  skipDue,
  updateRule,
  type NewRuleInput,
} from './recurringRules';
import { seedCategoryId } from './seed';

let db: KostenDB;
let counter = 0;

const MIETE = seedCategoryId('Miete');
const STROM = seedCategoryId('Strom');

beforeEach(async () => {
  counter += 1;
  db = createDb(`kostentracker-rules-${Date.now()}-${counter}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

function input(overrides: Partial<NewRuleInput> = {}): NewRuleInput {
  return {
    name: 'Miete',
    categoryId: MIETE,
    amountCents: 85000,
    interval: 'monthly',
    dayOfMonth: 1,
    startDate: '2026-01-01',
    autoPost: false,
    ...overrides,
  };
}

describe('Regeln verwalten', () => {
  it('legt Regeln aktiv an und normalisiert den Stichtag', async () => {
    const rule = await createRule(input({ dayOfMonth: 99, name: '  Miete  ' }), db);
    expect(rule.active).toBe(true);
    expect(rule.dayOfMonth).toBe(31);
    expect(rule.name).toBe('Miete');
    expect(rule.lastPostedDate).toBeUndefined();
  });

  it('ändert Regeln und entfernt geleerte Enddaten', async () => {
    const rule = await createRule(input({ endDate: '2026-12-31' }), db);
    await updateRule(rule.id, { amountCents: 90000, endDate: undefined }, db);
    expect((await db.recurringRules.get(rule.id))?.amountCents).toBe(90000);

    await updateRule(rule.id, { endDate: '' }, db);
    const stored = await db.recurringRules.get(rule.id);
    expect(stored && 'endDate' in stored).toBe(false);
  });

  it('sortiert aktive Regeln nach vorn', async () => {
    const alt = await createRule(input({ name: 'Alt' }), db);
    await createRule(input({ name: 'Neu' }), db);
    await setRuleActive(alt.id, false, db);
    expect((await listRules(db)).map((rule) => rule.name)).toEqual(['Neu', 'Alt']);
  });

  it('löscht Regeln, ohne Buchungen anzufassen', async () => {
    const rule = await createRule(input(), db);
    await postDue({ rule, date: '2026-01-01' }, db);
    await deleteRule(rule.id, db);

    expect(await db.recurringRules.count()).toBe(0);
    const transactions = await db.transactions.toArray();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.recurringRuleId).toBe(rule.id);
  });
});

describe('Fälligkeiten sammeln', () => {
  it('sammelt über mehrere Regeln hinweg, älteste zuerst', async () => {
    await createRule(input({ name: 'Miete', dayOfMonth: 1 }), db);
    await createRule(
      input({ name: 'Strom', categoryId: STROM, dayOfMonth: 15, amountCents: 8900 }),
      db,
    );

    const due = await collectDue('2026-02-20', db);
    expect(due.map((entry) => `${entry.date} ${entry.rule.name}`)).toEqual([
      '2026-01-01 Miete',
      '2026-01-15 Strom',
      '2026-02-01 Miete',
      '2026-02-15 Strom',
    ]);
  });

  it('lässt inaktive Regeln aus', async () => {
    const rule = await createRule(input(), db);
    await setRuleActive(rule.id, false, db);
    expect(await collectDue('2026-06-01', db)).toEqual([]);
  });
});

describe('Buchen und Idempotenz', () => {
  it('bucht mit Regeldaten und Quelle "recurring"', async () => {
    const rule = await createRule(input(), db);
    const transaction = await postDue({ rule, date: '2026-01-01' }, db);

    expect(transaction).toMatchObject({
      date: '2026-01-01',
      amountCents: 85000,
      categoryId: MIETE,
      source: 'recurring',
      recurringRuleId: rule.id,
      note: 'Miete',
    });
    expect((await db.recurringRules.get(rule.id))?.lastPostedDate).toBe('2026-01-01');
    expect((await db.categories.get(MIETE))?.usageCount).toBe(1);
  });

  it('bucht dieselbe Periode auch bei fünf App-Starts nur einmal', async () => {
    await createRule(input(), db);

    for (let start = 0; start < 5; start += 1) {
      const due = await collectDue('2026-03-10', db);
      await postAllDue(due, db);
    }

    const transactions = await db.transactions.toArray();
    expect(transactions).toHaveLength(3);
    expect(transactions.map((item) => item.date).sort()).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
    expect(await collectDue('2026-03-10', db)).toEqual([]);
  });

  it('erkennt Doppelbuchungen auch ohne lastPostedDate', async () => {
    const rule = await createRule(input(), db);
    await postDue({ rule, date: '2026-01-01' }, db);

    // Zeiger verloren, etwa durch ein eingespieltes Backup von einem anderen Stand.
    await db.recurringRules.update(rule.id, { lastPostedDate: undefined });
    const stale = (await db.recurringRules.get(rule.id))!;
    const again = await postDue({ rule: stale, date: '2026-01-01' }, db);

    expect(again).toBeNull();
    expect(await db.transactions.count()).toBe(1);
    expect((await db.recurringRules.get(rule.id))?.lastPostedDate).toBe('2026-01-01');
  });

  it('überspringt Termine, ohne zu buchen', async () => {
    const rule = await createRule(input(), db);
    await skipDue({ rule, date: '2026-01-01' }, db);

    expect(await db.transactions.count()).toBe(0);
    expect((await db.recurringRules.get(rule.id))?.lastPostedDate).toBe('2026-01-01');
    const due = await collectDue('2026-01-31', db);
    expect(due).toEqual([]);
  });

  it('zieht den Zeiger nie zurück', async () => {
    const rule = await createRule(input(), db);
    await postDue({ rule, date: '2026-03-01' }, db);
    await postDue({ rule, date: '2026-01-01' }, db);
    expect((await db.recurringRules.get(rule.id))?.lastPostedDate).toBe('2026-03-01');
  });

  it('bucht automatisch nur Regeln mit autoPost', async () => {
    await createRule(input({ name: 'Miete', autoPost: true }), db);
    await createRule(
      input({ name: 'Strom', categoryId: STROM, autoPost: false, dayOfMonth: 15 }),
      db,
    );

    const posted = await runAutoPost('2026-02-20', db);
    expect(posted).toBe(2);

    const transactions = await db.transactions.toArray();
    expect(transactions.every((item) => item.note === 'Miete')).toBe(true);

    // Die Regel ohne autoPost wartet weiter auf Bestätigung.
    const remaining = await collectDue('2026-02-20', db);
    expect(remaining.map((entry) => entry.rule.name)).toEqual(['Strom', 'Strom']);
  });

  it('bleibt beim wiederholten Automatiklauf stabil', async () => {
    await createRule(input({ autoPost: true }), db);
    await runAutoPost('2026-02-20', db);
    const second = await runAutoPost('2026-02-20', db);
    expect(second).toBe(0);
    expect(await db.transactions.count()).toBe(2);
  });

  it('kennt den nächsten Termin nach dem Buchen', async () => {
    const rule = await createRule(input(), db);
    await postDue({ rule, date: '2026-08-01' }, db);
    const stored = (await db.recurringRules.get(rule.id))!;
    expect(nextDueFor(stored, '2026-08-18')).toBe('2026-09-01');
  });
});
