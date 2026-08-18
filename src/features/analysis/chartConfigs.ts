import type { ChartConfiguration } from 'chart.js';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { CategorySeries, ShareSlice } from '../../lib/analytics';
import { monthStart, type MonthKey } from '../../lib/dates';
import { formatCents, formatCentsCompact } from '../../lib/money';
import type { ChartTheme } from './chartSetup';

/** "Aug", zum Jahreswechsel "Jan 27" — sonst wird die Achse unlesbar. */
export function monthTickLabel(month: MonthKey): string {
  const date = parseISO(monthStart(month));
  return month.endsWith('-01')
    ? format(date, 'MMM yy', { locale: de })
    : format(date, 'MMM', { locale: de });
}

function baseScales(theme: ChartTheme, stacked: boolean) {
  return {
    x: {
      stacked,
      grid: { display: false },
      ticks: { color: theme.dim, font: { size: 11 } },
      border: { color: theme.grid },
    },
    y: {
      stacked,
      beginAtZero: true,
      grid: { color: theme.grid },
      border: { display: false },
      ticks: {
        color: theme.dim,
        font: { size: 11 },
        maxTicksLimit: 5,
        // Bei sehr kleinen oder lauter Null-Werten rundet Chart.js mehrere
        // Schritte auf denselben Euro-Betrag. Doppelte Beschriftungen sehen
        // kaputt aus, also bleibt nur die erste stehen.
        callback(value: string | number, index: number, ticks: Array<{ value: number }>) {
          const label = formatCentsCompact(Number(value));
          const previous = ticks[index - 1];
          if (previous && formatCentsCompact(previous.value) === label) return undefined;
          return label;
        },
      },
    },
  };
}

function tooltipStyle(theme: ChartTheme) {
  return {
    backgroundColor: theme.text,
    titleColor: theme.surface,
    bodyColor: theme.surface,
    padding: 8,
    callbacks: {
      label: (item: { dataset: { label?: string }; parsed: { y: number | null } }) =>
        `${item.dataset.label ?? ''}: ${formatCents(item.parsed.y ?? 0)}`,
    },
  };
}

function legendStyle(theme: ChartTheme) {
  return {
    position: 'bottom' as const,
    labels: {
      color: theme.dim,
      boxWidth: 10,
      boxHeight: 10,
      font: { size: 11 },
      padding: 8,
    },
  };
}

/** Gestapelte Balken über zwölf Monate, gruppiert nach Kategorie. */
export function stackedCategoriesConfig(
  months: MonthKey[],
  series: CategorySeries[],
  theme: ChartTheme,
): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels: months.map(monthTickLabel),
      datasets: series.map((entry) => ({
        label: entry.name,
        data: entry.values,
        backgroundColor: entry.color,
        borderWidth: 0,
        borderRadius: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: theme.animated ? undefined : false,
      scales: baseScales(theme, true),
      plugins: { legend: legendStyle(theme), tooltip: tooltipStyle(theme) },
    },
  };
}

/** Anteil am gewählten Monat; ein Tap auf ein Segment öffnet den Drilldown. */
export function sharesConfig(
  slices: ShareSlice[],
  theme: ChartTheme,
  onSelect: (categoryId: string) => void,
): ChartConfiguration<'doughnut'> {
  return {
    type: 'doughnut',
    data: {
      labels: slices.map((slice) => slice.name),
      datasets: [
        {
          data: slices.map((slice) => slice.cents),
          backgroundColor: slices.map((slice) => slice.color),
          borderColor: theme.surface,
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      animation: theme.animated ? undefined : false,
      onClick: (_event, elements) => {
        const index = elements[0]?.index;
        if (index === undefined) return;
        const slice = slices[index];
        if (slice) onSelect(slice.categoryId);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.text,
          titleColor: theme.surface,
          bodyColor: theme.surface,
          padding: 8,
          callbacks: {
            label: (item: { label?: string; parsed: number }) =>
              `${item.label ?? ''}: ${formatCents(item.parsed)}`,
          },
        },
      },
    },
  };
}

/** Fixkosten gegen variable Kosten im Zeitverlauf. */
export function fixVariableConfig(
  months: MonthKey[],
  fix: number[],
  variable: number[],
  theme: ChartTheme,
): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: months.map(monthTickLabel),
      datasets: [
        {
          label: 'fix',
          data: fix,
          borderColor: '#8d7fc4',
          backgroundColor: 'rgba(141, 127, 196, 0.16)',
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: 'variabel',
          data: variable,
          borderColor: '#4c9f70',
          backgroundColor: 'rgba(76, 159, 112, 0.16)',
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: theme.animated ? undefined : false,
      interaction: { mode: 'index', intersect: false },
      scales: baseScales(theme, false),
      plugins: { legend: legendStyle(theme), tooltip: tooltipStyle(theme) },
    },
  };
}

/** Kumulierte Jahresausgaben mit dem Vorjahr als Vergleichslinie. */
export function cumulativeConfig(
  current: Array<number | null>,
  previous: Array<number | null>,
  year: number,
  theme: ChartTheme,
): ChartConfiguration<'line'> {
  const labels = Array.from({ length: 12 }, (_, index) =>
    monthTickLabel(`${year}-${String(index + 1).padStart(2, '0')}`),
  );

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: String(year),
          data: current,
          borderColor: theme.text,
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 2,
          spanGaps: false,
        },
        {
          label: String(year - 1),
          data: previous,
          borderColor: theme.dim,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 4],
          tension: 0.2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: theme.animated ? undefined : false,
      interaction: { mode: 'index', intersect: false },
      scales: baseScales(theme, false),
      plugins: { legend: legendStyle(theme), tooltip: tooltipStyle(theme) },
    },
  };
}

/** Zeitreihe einer einzelnen Kategorie im Drilldown. */
export function categoryTrendConfig(
  months: MonthKey[],
  values: number[],
  color: string,
  label: string,
  theme: ChartTheme,
): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels: months.map(monthTickLabel),
      datasets: [
        {
          label,
          data: values,
          backgroundColor: color,
          borderWidth: 0,
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: theme.animated ? undefined : false,
      scales: baseScales(theme, false),
      plugins: { legend: { display: false }, tooltip: tooltipStyle(theme) },
    },
  };
}
