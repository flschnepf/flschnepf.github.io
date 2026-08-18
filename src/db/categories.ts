import { newId } from '../lib/ids';
import { db as defaultDb, type KostenDB } from './db';
import type { Category, CategoryKind } from './types';

export async function listCategories(database: KostenDB = defaultDb): Promise<Category[]> {
  const rows = await database.categories.toArray();
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'de'));
}

export async function listActiveCategories(
  database: KostenDB = defaultDb,
): Promise<Category[]> {
  return (await listCategories(database)).filter((category) => !category.archived);
}

/** Reihenfolge der Chips auf dem Erfassen-Screen: haeufig genutzte nach vorn. */
export async function listCategoriesByUsage(
  database: KostenDB = defaultDb,
): Promise<Category[]> {
  const rows = await listActiveCategories(database);
  return rows.sort(
    (a, b) => b.usageCount - a.usageCount || a.sortOrder - b.sortOrder,
  );
}

export interface NewCategoryInput {
  name: string;
  color: string;
  kind: CategoryKind;
  parentId?: string;
}

export async function createCategory(
  input: NewCategoryInput,
  database: KostenDB = defaultDb,
): Promise<Category> {
  const existing = await database.categories.toArray();
  const maxOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), -1);
  const category: Category = {
    id: newId(),
    name: input.name.trim(),
    color: input.color,
    kind: input.kind,
    archived: false,
    sortOrder: maxOrder + 1,
    usageCount: 0,
  };
  if (input.parentId) category.parentId = input.parentId;
  await database.categories.add(category);
  return category;
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'color' | 'kind' | 'sortOrder' | 'parentId'>>,
  database: KostenDB = defaultDb,
): Promise<void> {
  const clean: Record<string, unknown> = { ...patch };
  if (typeof clean.name === 'string') clean.name = clean.name.trim();
  await database.categories.update(id, clean);
}

/**
 * Kategorien werden nie geloescht — historische Buchungen zeigen sonst ins
 * Leere. Archivierte Kategorien verschwinden nur aus der Auswahl.
 */
export async function setCategoryArchived(
  id: string,
  archived: boolean,
  database: KostenDB = defaultDb,
): Promise<void> {
  await database.categories.update(id, { archived });
}

export function categoryMap(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((category) => [category.id, category]));
}
