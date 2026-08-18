import { lazy, Suspense, useEffect, useRef } from 'react';
import { ensurePersistence } from './app/persistence';
import { navigate, useRoute, type Route } from './app/router';
import { reloadWithUpdate, useOfflineReady, useUpdateAvailable } from './app/updatePrompt';
import { runAutoPostOnce } from './db/recurringRules';
import { queryTransactions, sumCents } from './db/transactions';
import { useLiveQuery } from './db/useLiveQuery';
import { CaptureScreen } from './features/capture/CaptureScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { RecurringScreen } from './features/recurring/RecurringScreen';
import { ShoppingScreen } from './features/shopping/ShoppingScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { currentMonthKey, monthEnd, monthStart } from './lib/dates';
import { formatCents } from './lib/money';
import { TabBar } from './ui/TabBar';
import { ToastProvider, useToast } from './ui/Toast';

/*
 * Chart.js ist gross und wird nur auf einem von sechs Screens gebraucht. Der
 * Erfassen-Screen soll nicht darauf warten muessen; der Service Worker legt den
 * Chunk trotzdem in den Cache, offline bleibt also alles da.
 */
const AnalysisScreen = lazy(async () => ({
  default: (await import('./features/analysis/AnalysisScreen')).AnalysisScreen,
}));

const TITLES: Record<Route, string> = {
  erfassen: 'Erfassen',
  liste: 'Einkaufsliste',
  auswertung: 'Auswertung',
  fixkosten: 'Fixkosten',
  verlauf: 'Verlauf',
  einstellungen: 'Einstellungen',
};

/**
 * Meldet einmalig, dass die App vollstaendig im Cache liegt. Sitzt im Provider,
 * weil `useToast` sonst nicht erreichbar waere.
 */
function OfflineReadyNotice() {
  const offlineReady = useOfflineReady();
  const showToast = useToast();
  const announced = useRef(false);

  useEffect(() => {
    if (!offlineReady || announced.current) return;
    announced.current = true;
    showToast({ message: 'Offline bereit — läuft jetzt auch ohne Netz.' });
  }, [offlineReady, showToast]);

  return null;
}

export function App() {
  const route = useRoute();
  const updateAvailable = useUpdateAvailable();

  useEffect(() => {
    void ensurePersistence();
    // Faellige Regeln mit autoPost gleich beim Start buchen; der Rest wartet
    // auf dem Fixkosten-Screen auf Bestaetigung.
    void runAutoPostOnce();
  }, []);

  const monthTotal = useLiveQuery(
    async () => {
      const month = currentMonthKey();
      const rows = await queryTransactions({
        from: monthStart(month),
        to: monthEnd(month),
      });
      return sumCents(rows);
    },
    [],
    0,
  );

  return (
    <ToastProvider>
      <OfflineReadyNotice />
      <div className="app">
        <header className="appHeader">
          <h1>{TITLES[route]}</h1>
          <div className="row">
            <span className="muted num" aria-label="Summe dieses Monats">
              {formatCents(monthTotal)}
            </span>
            <button
              type="button"
              className="iconButton"
              aria-label="Einstellungen"
              aria-current={route === 'einstellungen' ? 'page' : undefined}
              onClick={() => navigate(route === 'einstellungen' ? 'erfassen' : 'einstellungen')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
              </svg>
            </button>
          </div>
        </header>

        {updateAvailable && (
          <div className="updateBar" role="status">
            <span>Neue Version installiert.</span>
            <button type="button" className="btn btnSmall" onClick={reloadWithUpdate}>
              Neu laden
            </button>
          </div>
        )}

        <main className={`appMain${route === 'erfassen' ? ' noScroll' : ''}`}>

          {route === 'erfassen' && <CaptureScreen />}
          {route === 'liste' && <ShoppingScreen />}
          {route === 'auswertung' && (
            <Suspense fallback={<p className="empty">Diagramme werden geladen …</p>}>
              <AnalysisScreen />
            </Suspense>
          )}
          {route === 'fixkosten' && <RecurringScreen />}
          {route === 'verlauf' && <HistoryScreen />}
          {route === 'einstellungen' && <SettingsScreen />}
        </main>

        <TabBar current={route} />
      </div>
    </ToastProvider>
  );
}
