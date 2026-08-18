import { useMemo, useState } from 'react';
import { listCategories } from '../../db/categories';
import { queryTransactions } from '../../db/transactions';
import type { Category, Transaction } from '../../db/types';
import { useLiveQuery } from '../../db/useLiveQuery';
import {
  buildIndex,
  categorySeriesFor,
  categoryShares,
  cumulativeYear,
  fixVariableSeries,
  lastMonths,
  monthlySummary,
} from '../../lib/analytics';
import {
  addMonthsToKey,
  currentMonthKey,
  formatMonthLabel,
  type MonthKey,
} from '../../lib/dates';
import { formatCents } from '../../lib/money';
import { CategoryDrilldown } from './CategoryDrilldown';
import { ChartCanvas } from './ChartCanvas';
import {
  cumulativeConfig,
  fixVariableConfig,
  sharesConfig,
  stackedCategoriesConfig,
} from './chartConfigs';
import { chartTheme } from './chartSetup';
import { useThemeVersion } from './useThemeVersion';

const NO_TRANSACTIONS: Transaction[] = [];
const NO_CATEGORIES: Category[] = [];
const TREND_MONTHS = 12;

function DeltaLine({ label, cents }: { label: string; cents: number }) {
  const word = cents > 0 ? 'mehr' : cents < 0 ? 'weniger' : 'gleich';
  const arrow = cents > 0 ? '▲' : cents < 0 ? '▼' : '·';
  const tone = cents > 0 ? ' up' : cents < 0 ? ' down' : '';
  return (
    <div className="rowBetween">
      <span className="muted">{label}</span>
      <span className={`num delta${tone}`}>
        {arrow} {formatCents(Math.abs(cents))} {word}
      </span>
    </div>
  );
}

export function AnalysisScreen() {
  const themeVersion = useThemeVersion();
  const transactions = useLiveQuery(() => queryTransactions(), [], NO_TRANSACTIONS);
  const categories = useLiveQuery(() => listCategories(), [], NO_CATEGORIES);

  const [month, setMonth] = useState<MonthKey>(() => currentMonthKey());
  const [drilldownId, setDrilldownId] = useState<string | null>(null);

  const index = useMemo(() => buildIndex(transactions), [transactions]);
  const months = useMemo(() => lastMonths(month, TREND_MONTHS), [month]);
  const summary = useMemo(() => monthlySummary(index, month), [index, month]);
  const shares = useMemo(
    () => categoryShares(index, [month], categories),
    [index, month, categories],
  );
  const series = useMemo(
    () => categorySeriesFor(index, months, categories),
    [index, months, categories],
  );
  const fixVariable = useMemo(
    () => fixVariableSeries(index, months, categories),
    [index, months, categories],
  );

  const year = Number(month.slice(0, 4));
  const thisMonth = currentMonthKey();
  const currentYearValues = useMemo(
    () => cumulativeYear(index, year, year === Number(thisMonth.slice(0, 4)) ? thisMonth : undefined),
    [index, year, thisMonth],
  );
  const previousYearValues = useMemo(() => cumulativeYear(index, year - 1), [index, year]);

  /* themeVersion erzwingt den Neuaufbau, wenn Farbschema oder Bewegungsvorliebe wechseln. */
  /* eslint-disable react-hooks/exhaustive-deps */
  const sharesChart = useMemo(
    () => sharesConfig(shares.slices, chartTheme(), setDrilldownId),
    [shares, themeVersion],
  );
  const stackedChart = useMemo(
    () => stackedCategoriesConfig(months, series, chartTheme()),
    [months, series, themeVersion],
  );
  const fixVariableChart = useMemo(
    () => fixVariableConfig(months, fixVariable.fix, fixVariable.variable, chartTheme()),
    [months, fixVariable, themeVersion],
  );
  const cumulativeChart = useMemo(
    () => cumulativeConfig(currentYearValues, previousYearValues, year, chartTheme()),
    [currentYearValues, previousYearValues, year, themeVersion],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const drilldownCategory = categories.find((category) => category.id === drilldownId);
  const latestMonth = index.lastMonth && index.lastMonth > thisMonth ? index.lastMonth : thisMonth;

  if (drilldownCategory) {
    return (
      <CategoryDrilldown
        category={drilldownCategory}
        month={month}
        index={index}
        transactions={transactions}
        onClose={() => setDrilldownId(null)}
      />
    );
  }

  return (
    <>
      <div className="monthStepper">
        <button
          type="button"
          className="btn btnSmall"
          aria-label="Vorheriger Monat"
          onClick={() => setMonth(addMonthsToKey(month, -1))}
        >
          ◀
        </button>
        <strong>{formatMonthLabel(month)}</strong>
        <button
          type="button"
          className="btn btnSmall"
          aria-label="Nächster Monat"
          disabled={month >= latestMonth}
          onClick={() => setMonth(addMonthsToKey(month, 1))}
        >
          ▶
        </button>
      </div>

      {transactions.length === 0 && (
        <p className="empty">
          Noch keine Buchungen erfasst. Die Diagramme füllen sich, sobald etwas da ist.
        </p>
      )}

      <section className="card">
        <h2>Monatssumme</h2>
        <p className="bigNumber num">{formatCents(summary.totalCents)}</p>
        <DeltaLine label="zum Vormonat" cents={summary.deltaPreviousCents} />
        <DeltaLine label="zum Schnitt der 3 Vormonate" cents={summary.deltaAverageCents} />
        <p className="faint" style={{ marginTop: 6 }}>
          Vormonat {formatCents(summary.previousCents)} · Schnitt{' '}
          {formatCents(summary.averageThreeCents)}
        </p>
      </section>

      <section className="card">
        <h2>Anteile im Monat</h2>
        {shares.slices.length === 0 ? (
          <p className="empty">Keine Ausgaben in diesem Monat.</p>
        ) : (
          <>
            <ChartCanvas
              config={sharesChart}
              label={`Anteil der Kategorien im ${formatMonthLabel(month)}`}
              height={200}
            />
            <ul className="shareList">
              {shares.slices.map((slice) => (
                <li key={slice.categoryId}>
                  <button
                    type="button"
                    className="shareRow"
                    onClick={() => setDrilldownId(slice.categoryId)}
                  >
                    <span className="dot" style={{ background: slice.color }} />
                    <span className="txTitle">{slice.name}</span>
                    <span className="faint num">{Math.round(slice.share * 100)} %</span>
                    <span className="txAmount num">{formatCents(slice.cents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {shares.omitted > 0 && (
          <p className="faint">
            {shares.omitted} Kategorie(n) mit Erstattungsüberhang lassen sich im Kreis
            nicht darstellen.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Zwölf Monate nach Kategorie</h2>
        <ChartCanvas
          config={stackedChart}
          label="Gestapelte Monatsausgaben nach Kategorie"
          height={260}
        />
      </section>

      <section className="card">
        <h2>Fix gegen variabel</h2>
        <ChartCanvas
          config={fixVariableChart}
          label="Fixkosten und variable Kosten im Zeitverlauf"
          height={220}
        />
      </section>

      <section className="card">
        <h2>Kumuliert im Jahr</h2>
        <ChartCanvas
          config={cumulativeChart}
          label={`Kumulierte Ausgaben ${year} im Vergleich zu ${year - 1}`}
          height={220}
        />
      </section>
    </>
  );
}
