import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

/**
 * Chart.js wird nur mit den tatsaechlich benutzten Bausteinen registriert —
 * alles andere faellt beim Bundeln raus. Keine Plugins von aussen, keine
 * Schriften aus dem Netz.
 */
let registered = false;

export function setupCharts(): void {
  if (registered) return;
  Chart.register(
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    DoughnutController,
    Filler,
    Legend,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
  );
  registered = true;
}

/** Farben kommen aus dem Stylesheet, damit Charts dem Dark Mode folgen. */
export function cssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value === '' ? fallback : value;
}

export interface ChartTheme {
  text: string;
  dim: string;
  grid: string;
  surface: string;
  animated: boolean;
}

export function chartTheme(): ChartTheme {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    text: cssColor('--text', '#14181b'),
    dim: cssColor('--text-dim', '#5d666d'),
    grid: cssColor('--border', '#ccd2d8'),
    surface: cssColor('--surface', '#ffffff'),
    animated: !reducedMotion,
  };
}
