/**
 * Pure helpers for the gas/oil global search:
 * result flattening, keyboard navigation state and accessible labels.
 */

import type { GasOilSearchItem, GasOilSearchResponse } from '../types/gas-oil'

export interface SearchGroup {
  key: keyof GasOilSearchResponse['results']
  label: string
}

export const SEARCH_GROUPS: SearchGroup[] = [
  { key: 'geographies', label: 'Geographies' },
  { key: 'indicators', label: 'Indicators' },
  { key: 'benchmarks', label: 'Price benchmarks' },
  { key: 'assets', label: 'Infrastructure assets' },
  { key: 'sources', label: 'Data sources' },
]

/**
 * Flatten grouped search results into a single ordered list used for
 * keyboard navigation. Duplicates across groups are preserved (they are
 * disambiguated by type label and scope).
 */
export function flattenSearchItems(response: GasOilSearchResponse | null): GasOilSearchItem[] {
  if (!response) return []
  return SEARCH_GROUPS.flatMap((group) => response.results[group.key] ?? [])
}

export interface SearchNavState {
  items: GasOilSearchItem[]
  /** Index of the active item, or -1 when none is active. */
  activeIndex: number
}

/**
 * Create a nav state for a result set. The first item is active so Enter
 * works immediately after results load.
 */
export function createSearchNav(items: GasOilSearchItem[]): SearchNavState {
  return { items, activeIndex: items.length > 0 ? 0 : -1 }
}

/**
 * Move the active item with wrap-around.
 */
export function moveSearchNav(state: SearchNavState, direction: 1 | -1): SearchNavState {
  if (state.items.length === 0) return { ...state, activeIndex: -1 }
  const span = state.items.length
  const next =
    state.activeIndex < 0
      ? direction === 1
        ? 0
        : span - 1
      : (state.activeIndex + direction + span) % span
  return { ...state, activeIndex: next }
}

/**
 * Return the currently active item, or null when nothing is active.
 */
export function selectSearchItem(state: SearchNavState): GasOilSearchItem | null {
  if (state.activeIndex < 0 || state.activeIndex >= state.items.length) return null
  return state.items[state.activeIndex] ?? null
}

export function itemOptionId(item: GasOilSearchItem): string {
  return `gas-oil-search-option-${item.id}`
}

/**
 * Accessible label for a result: name, type, scope and aliases. Duplicate
 * names in different groups are therefore announced distinctly.
 */
export function resultAriaLabel(item: GasOilSearchItem): string {
  const parts = [item.name, item.typeLabel]
  if (item.scope) parts.push(item.scope)
  if (item.aliases?.length) parts.push(`also known as ${item.aliases.join(', ')}`)
  return parts.join(', ')
}
