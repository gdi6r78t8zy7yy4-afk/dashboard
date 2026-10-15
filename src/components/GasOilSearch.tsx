import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, Loader2, AlertTriangle, X } from 'lucide-react'
import type { GasOilSearchItem, GasOilSearchResponse } from '../types/gas-oil'
import {
  SEARCH_GROUPS,
  createSearchNav,
  flattenSearchItems,
  itemOptionId,
  moveSearchNav,
  resultAriaLabel,
  selectSearchItem,
  type SearchNavState,
} from '../lib/gasOilSearch'

interface GasOilSearchProps {
  /** Called with the selected search item (including its detail record). */
  onSelect: (item: GasOilSearchItem) => void
}

type SearchPhase = 'idle' | 'loading' | 'ready' | 'error'

const DEBOUNCE_MS = 250
const MIN_QUERY_LENGTH = 2

/**
 * Global search across the gas/oil data model: geographies, indicators,
 * price benchmarks, demo assets and data sources.
 *
 * - Debounced (250 ms) with request cancellation via AbortController.
 * - Loading, no-results and error states are explicit.
 * - Full keyboard support: ArrowUp/ArrowDown (wrapping), Enter, Escape.
 * - Results are grouped by type with explicit type labels and geographic
 *   scope so duplicate names are disambiguated.
 */
export const GasOilSearch = ({ onSelect }: GasOilSearchProps) => {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<SearchPhase>('idle')
  const [response, setResponse] = useState<GasOilSearchResponse | null>(null)
  const [nav, setNav] = useState<SearchNavState>(() => createSearchNav([]))
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const trimmed = query.trim()

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('loading')
    try {
      const res = await fetch(`/api/v1/gas-oil/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Search API returned ${res.status}`)
      const data: GasOilSearchResponse = await res.json()
      setResponse(data)
      setNav(createSearchNav(flattenSearchItems(data)))
      setPhase('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort()
      setResponse(null)
      setNav(createSearchNav([]))
      setPhase('idle')
      setOpen(false)
      return
    }
    setOpen(true)
    debounceRef.current = window.setTimeout(() => runSearch(trimmed), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [trimmed, runSearch])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const handleSelect = (item: GasOilSearchItem) => {
    setOpen(false)
    onSelect(item)
    setQuery('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (trimmed.length >= MIN_QUERY_LENGTH) setOpen(true)
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setNav((state) => moveSearchNav(state, 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setNav((state) => moveSearchNav(state, -1))
        break
      case 'Enter': {
        event.preventDefault()
        const item = selectSearchItem(nav)
        if (item) handleSelect(item)
        break
      }
      case 'Escape':
        setOpen(false)
        break
      default:
        break
    }
  }

  const activeOptionId = nav.activeIndex >= 0 ? itemOptionId(nav.items[nav.activeIndex]) : null

  return (
    <div className="gas-oil-search">
      <label htmlFor="gas-oil-search-input" className="visually-hidden">
        Search gas and oil data
      </label>
      <div className="gas-oil-search-box">
        <Search size={15} className="gas-oil-search-icon" />
        <input
          ref={inputRef}
          id="gas-oil-search-input"
          role="combobox"
          aria-expanded={open}
          aria-controls="gas-oil-search-listbox"
          aria-activedescendant={activeOptionId ?? undefined}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search countries, indicators, benchmarks, assets, sources…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (trimmed.length >= MIN_QUERY_LENGTH) setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150)
          }}
        />
        {query && (
          <button
            type="button"
            className="gas-oil-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
              setOpen(false)
              inputRef.current?.focus()
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && trimmed.length >= MIN_QUERY_LENGTH && (
        <div className="gas-oil-search-dropdown" ref={listboxRef}>
          {phase === 'loading' && (
            <div className="gas-oil-search-state" role="status">
              <Loader2 size={14} className="spin" />
              <span>Searching…</span>
            </div>
          )}

          {phase === 'error' && (
            <div className="gas-oil-search-state error" role="alert">
              <AlertTriangle size={14} />
              <span>Search failed.</span>
              <button type="button" onClick={() => runSearch(trimmed)}>
                Retry
              </button>
            </div>
          )}

          {phase === 'ready' && response && (
            <>
              {response.total === 0 ? (
                <div className="gas-oil-search-state" role="status">
                  <span>No results for “{response.query}”.</span>
                  <small>{response.coverage.note}</small>
                </div>
              ) : (
                <ul
                  id="gas-oil-search-listbox"
                  role="listbox"
                  aria-label="Gas and oil search results"
                >
                  {SEARCH_GROUPS.map((group) => {
                    const items = response.results[group.key]
                    if (!items.length) return null
                    return (
                      <li key={group.key} role="presentation">
                        <div className="gas-oil-search-group-label">{group.label}</div>
                        {items.map((item) => {
                          const id = itemOptionId(item)
                          const active = activeOptionId === id
                          return (
                            <button
                              key={id}
                              type="button"
                              id={id}
                              role="option"
                              aria-selected={active}
                              aria-label={resultAriaLabel(item)}
                              className={`gas-oil-search-option ${active ? 'active' : ''}`}
                              onMouseDown={(event) => {
                                event.preventDefault()
                                handleSelect(item)
                              }}
                              onMouseEnter={() =>
                                setNav((state) => {
                                  const index = state.items.findIndex((i) => i === item)
                                  return index < 0 ? state : { ...state, activeIndex: index }
                                })
                              }
                            >
                              <span className="option-name">{item.name}</span>
                              <span className="option-meta">
                                <span className="option-type">{item.typeLabel}</span>
                                {item.scope && <span className="option-scope">{item.scope}</span>}
                              </span>
                              {item.aliases?.length ? (
                                <small className="option-aliases">a.k.a. {item.aliases.join(', ')}</small>
                              ) : null}
                            </button>
                          )
                        })}
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="gas-oil-search-footer">
                <small>{response.coverage.note}</small>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default GasOilSearch
