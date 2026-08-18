import { useMemo, useState } from 'react';
import { listCategories, categoryMap } from '../../db/categories';
import {
  queryTransactions,
  sumCents,
  type TransactionFilter,
} from '../../db/transactions';
import type { Category, Transaction } from '../../db/types';
import { useLiveQuery } from '../../db/useLiveQuery';
import {
  currentMonthKey,
  formatDayShort,
  formatMonthLabel,
  monthEnd,
  monthKeyOf,
  monthStart,
  monthsBackFrom,
  todayISO,
} from '../../lib/dates';
import { formatCents } from '../../lib/money';
import { TransactionEditor } from './TransactionEditor';

type Period = 'month' | 'quarter' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Dieser Monat',
  quarter: 'Letzte 3 Monate',
  year: 'Dieses Jahr',
  all: 'Alles',
};

const NO_CATEGORIES: Category[] = [];
const NO_TRANSACTIONS: Transaction[] = [];

function rangeFor(period: Period): { from?: string; to?: string } {
  const today = todayISO();
  switch (period) {
    case 'month':
      return { from: monthStart(currentMonthKey()), to: monthEnd(currentMonthKey()) };
    case 'quarter':
      return { from: monthsBackFrom(today, 2), to: monthEnd(currentMonthKey()) };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'all':
      return {};
  }
}

export function HistoryScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [categoryId, setCategoryId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const categories = useLiveQuery(() => listCategories(), [], NO_CATEGORIES);
  const filter: TransactionFilter = useMemo(() => {
    const range = rangeFor(period);
    return categoryId ? { ...range, categoryId } : range;
  }, [period, categoryId]);

  const transactions = useLiveQuery(
    () => queryTransactions(filter),
    [filter],
    NO_TRANSACTIONS,
  );

  const byId = useMemo(() => categoryMap(categories), [categories]);
  const groups = useMemo(() => groupByMonth(transactions), [transactions]);
  const editing = transactions.find((item) => item.id === editingId) ?? null;

  if (editing) {
    return (
      <TransactionEditor
        transaction={editing}
        categories={categories}
        onClose={() => setEditingId(null)}
      />
    );
  }

  return (
    <>
      <div className="filterBar">
        <select
          className="select"
          aria-label="Zeitraum"
          value={period}
          onChange={(event) => setPeriod(event.target.value as Period)}
        >
          {(Object.keys(PERIOD_LABELS) as Period[]).map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label="Kategorie"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Alle Kategorien</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.archived ? ' (archiviert)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="rowBetween muted">
        <span>
          {transactions.length} {transactions.length === 1 ? 'Buchung' : 'Buchungen'}
        </span>
        <strong className="num">{formatCents(sumCents(transactions))}</strong>
      </div>

      {transactions.length === 0 && (
        <p className="empty">Für diesen Filter gibt es keine Buchungen.</p>
      )}

      {groups.map(([month, items]) => (
        <section key={month}>
          <h2 className="monthHead">
            <span>{formatMonthLabel(month)}</span>
            <span className="sum num">{formatCents(sumCents(items))}</span>
          </h2>
          <ul className="txList">
            {items.map((item) => {
              const category = byId.get(item.categoryId);
              const meta = [item.merchant, item.note].filter(Boolean).join(' · ');
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="txRow"
                    onClick={() => setEditingId(item.id)}
                  >
                    <span
                      className="dot"
                      style={{ background: category?.color ?? 'var(--text-faint)' }}
                    />
                    <span className="txMain">
                      <span className="txTitle">{category?.name ?? 'Unbekannt'}</span>
                      <span className="txMeta">
                        <span className="num">{formatDayShort(item.date)}</span>
                        {meta ? ` · ${meta}` : ''}
                      </span>
                    </span>
                    <span
                      className={`txAmount num${item.amountCents < 0 ? ' refund' : ''}`}
                    >
                      {formatCents(item.amountCents)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Nach Monat gruppiert, neueste Gruppe zuerst. */
function groupByMonth(transactions: Transaction[]): Array<[string, Transaction[]]> {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = monthKeyOf(transaction.date);
    const bucket = groups.get(key);
    if (bucket) bucket.push(transaction);
    else groups.set(key, [transaction]);
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}
