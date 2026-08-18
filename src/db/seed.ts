import type { Category } from './types';

/**
 * Feste IDs statt `randomUUID()`: So treffen Buchungen aus einem Backup auch
 * dann auf ihre Kategorie, wenn sie in eine frisch angelegte Datenbank
 * importiert werden.
 */
function seedId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

interface SeedSpec {
  /**
   * Bestimmt die ID und bleibt für immer an dieser Kategorie hängen. Nachträglich
   * ergänzte Kategorien bekommen die nächste freie Nummer, egal wo sie in der
   * Liste stehen — sonst verschieben sich die IDs bestehender Einträge.
   */
  index: number;
  name: string;
  color: string;
  kind: Category['kind'];
}

/**
 * Reihenfolge in dieser Liste = Anzeigereihenfolge (`sortOrder`).
 * Kategoriefarben sind die einzige kraeftige Farbe im Interface und tragen
 * Information — deshalb gut unterscheidbar und in beiden Themes lesbar.
 */
const SEED: SeedSpec[] = [
  { index: 1, name: 'Lebensmittel', color: '#4c9f70', kind: 'variabel' },
  { index: 2, name: 'Drogerie', color: '#7bb7c7', kind: 'variabel' },
  { index: 3, name: 'Strom', color: '#e0a33c', kind: 'fix' },
  { index: 4, name: 'Gas/Heizung', color: '#d4713a', kind: 'fix' },
  { index: 5, name: 'Wasser', color: '#5b8fd6', kind: 'fix' },
  { index: 6, name: 'Rundfunkbeitrag', color: '#8d7fc4', kind: 'fix' },
  { index: 7, name: 'Internet/Mobilfunk', color: '#4a90a4', kind: 'fix' },
  { index: 8, name: 'Versicherungen', color: '#9a8c78', kind: 'fix' },
  { index: 14, name: 'Abos', color: '#a45a9e', kind: 'fix' },
  { index: 9, name: 'Miete', color: '#c25b6b', kind: 'fix' },
  { index: 10, name: 'Mobilität', color: '#6b8f3f', kind: 'variabel' },
  { index: 11, name: 'Restaurant', color: '#d1567f', kind: 'variabel' },
  { index: 12, name: 'Anschaffungen', color: '#7a86c9', kind: 'variabel' },
  { index: 13, name: 'Sonstiges', color: '#8a8f94', kind: 'variabel' },
];

export function seedCategories(): Category[] {
  return SEED.map((spec, position) => ({
    id: seedId(spec.index),
    name: spec.name,
    color: spec.color,
    kind: spec.kind,
    archived: false,
    sortOrder: position,
    usageCount: 0,
  }));
}

/** In Anzeigereihenfolge. */
export const SEED_CATEGORY_IDS = SEED.map((spec) => seedId(spec.index));

/** Für Tests und Migrationen: die feste ID einer Startkategorie. */
export function seedCategoryId(name: string): string {
  const spec = SEED.find((entry) => entry.name === name);
  if (!spec) throw new Error(`Unbekannte Startkategorie: ${name}`);
  return seedId(spec.index);
}

/** Erst ab Schema v3 dabei; Bestandsdatenbanken bekommen sie per Upgrade. */
export function abosCategory(): Category {
  const abos = seedCategories().find((category) => category.name === 'Abos');
  if (!abos) throw new Error('Kategorie "Abos" fehlt im Seed.');
  return abos;
}
