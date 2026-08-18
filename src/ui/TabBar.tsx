import type { ReactElement } from 'react';
import { navigate, type Route } from '../app/router';

interface TabSpec {
  route: Route;
  label: string;
  icon: ReactElement;
}

/*
 * Inline-SVG statt Icon-Font oder Sprite-Sheet: nichts wird zur Laufzeit
 * nachgeladen. Fuenf Eintraege sind das Maximum, deshalb sitzt "Einstellungen"
 * im Kopf der App und nicht hier.
 */
const TABS: TabSpec[] = [
  {
    route: 'erfassen',
    label: 'Erfassen',
    icon: (
      <svg className="tabIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    route: 'liste',
    label: 'Liste',
    icon: (
      <svg className="tabIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 7h3M4 12h3M4 17h3" />
        <path d="M10 7h10M10 12h10M10 17h6" />
      </svg>
    ),
  },
  {
    route: 'auswertung',
    label: 'Auswertung',
    icon: (
      <svg className="tabIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    route: 'fixkosten',
    label: 'Fixkosten',
    icon: (
      <svg className="tabIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M7 3.5v3M17 3.5v3" />
        <rect x="3.5" y="6" width="17" height="14.5" rx="2.5" />
        <path d="M3.5 10.5h17" />
        <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    route: 'verlauf',
    label: 'Verlauf',
    icon: (
      <svg className="tabIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
];

export function TabBar({ current }: { current: Route }) {
  return (
    <nav className="tabBar" aria-label="Hauptnavigation">
      {TABS.map((tab) => (
        <button
          key={tab.route}
          type="button"
          aria-current={tab.route === current ? 'page' : undefined}
          onClick={() => navigate(tab.route)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
