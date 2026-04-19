import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const BOOKING_URLS = {
  SQ: 'https://www.singaporeair.com/en_UK/sg/plan-travel/promotions/global/kf/kf-promo/kfescapes/',
  TR: 'https://www.flyscoot.com/en/krisflyer/spontaneous-escapes',
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: '#e8eaf6',
    padding: '0 0 60px 0',
  },
  header: {
    background: 'linear-gradient(90deg, #1a237e 0%, #283593 100%)',
    borderBottom: '1px solid #3949ab',
    padding: '20px 24px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  headerTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    color: '#fff',
  },
  headerSub: {
    fontSize: '12px',
    color: '#90caf9',
    marginTop: '2px',
  },
  lastUpdated: {
    fontSize: '11px',
    color: '#7986cb',
    textAlign: 'right',
  },
  filtersPanel: {
    background: 'rgba(26,35,126,0.35)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(57,73,171,0.4)',
    padding: '16px 24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
    alignItems: 'end',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#90caf9',
  },
  input: {
    background: 'rgba(13,31,60,0.8)',
    border: '1px solid #3949ab',
    borderRadius: '6px',
    color: '#e8eaf6',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    background: 'rgba(13,31,60,0.8)',
    border: '1px solid #3949ab',
    borderRadius: '6px',
    color: '#e8eaf6',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  dayToggleRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  dayBtn: (active) => ({
    background: active ? '#3949ab' : 'rgba(13,31,60,0.8)',
    border: `1px solid ${active ? '#5c6bc0' : '#3949ab'}`,
    borderRadius: '5px',
    color: active ? '#fff' : '#7986cb',
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    minWidth: '36px',
    textAlign: 'center',
  }),
  flexModeRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  flexBtn: (active) => ({
    background: active ? '#1565c0' : 'rgba(13,31,60,0.8)',
    border: `1px solid ${active ? '#1976d2' : '#3949ab'}`,
    borderRadius: '5px',
    color: active ? '#fff' : '#7986cb',
    padding: '5px 10px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  sliderWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  slider: {
    flex: 1,
    accentColor: '#5c6bc0',
    cursor: 'pointer',
  },
  sliderVal: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#90caf9',
    minWidth: '20px',
    textAlign: 'right',
  },
  main: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '20px 16px',
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  statsBadge: {
    background: 'rgba(57,73,171,0.3)',
    border: '1px solid #3949ab',
    borderRadius: '20px',
    padding: '4px 14px',
    fontSize: '12px',
    color: '#90caf9',
  },
  sortSelect: {
    background: 'rgba(13,31,60,0.8)',
    border: '1px solid #3949ab',
    borderRadius: '6px',
    color: '#e8eaf6',
    padding: '6px 10px',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '14px',
  },
  card: (expanded) => ({
    background: expanded
      ? 'linear-gradient(135deg, rgba(21,101,192,0.25) 0%, rgba(26,35,126,0.35) 100%)'
      : 'linear-gradient(135deg, rgba(13,31,60,0.9) 0%, rgba(20,28,60,0.95) 100%)',
    border: `1px solid ${expanded ? '#1976d2' : 'rgba(57,73,171,0.5)'}`,
    borderRadius: '10px',
    overflow: 'hidden',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: expanded ? '0 0 20px rgba(25,118,210,0.25)' : '0 2px 8px rgba(0,0,0,0.3)',
    cursor: 'pointer',
  }),
  cardHeader: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  airlineBadge: (airline) => ({
    background: airline === 'SQ' ? 'rgba(26,35,126,0.8)' : 'rgba(0,100,0,0.6)',
    border: `1px solid ${airline === 'SQ' ? '#3f51b5' : '#2e7d32'}`,
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    color: airline === 'SQ' ? '#90caf9' : '#a5d6a7',
    letterSpacing: '0.5px',
  }),
  cabinBadge: (cabin) => ({
    background: cabin === 'Business' ? 'rgba(120,60,0,0.5)' : 'rgba(13,31,60,0.6)',
    border: `1px solid ${cabin === 'Business' ? '#f57c00' : '#37474f'}`,
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    color: cabin === 'Business' ? '#ffcc80' : '#90a4ae',
  }),
  routeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cityText: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#e3f2fd',
  },
  arrowText: {
    fontSize: '16px',
    color: '#5c6bc0',
  },
  milesRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  milesNum: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#ffd740',
    lineHeight: 1,
  },
  milesLabel: {
    fontSize: '12px',
    color: '#90a4ae',
  },
  discountBadge: (pct) => ({
    background: 'rgba(46,125,50,0.4)',
    border: '1px solid #388e3c',
    borderRadius: '4px',
    padding: '2px 7px',
    fontSize: '11px',
    color: '#81c784',
    fontWeight: 700,
  }),
  datesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
    marginTop: '4px',
  },
  datePip: (avail) => ({
    background: avail ? 'rgba(46,125,50,0.35)' : 'rgba(100,0,0,0.3)',
    border: `1px solid ${avail ? '#388e3c' : '#c62828'}`,
    borderRadius: '4px',
    padding: '2px 7px',
    fontSize: '10px',
    color: avail ? '#a5d6a7' : '#ef9a9a',
    fontWeight: 600,
  }),
  availCount: {
    fontSize: '11px',
    color: '#7986cb',
    marginTop: '4px',
  },
  drawer: {
    borderTop: '1px solid rgba(57,73,171,0.4)',
    padding: '14px 16px',
    background: 'rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  drawerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  drawerLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#7986cb',
  },
  flightList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  flightChip: {
    background: 'rgba(26,35,126,0.5)',
    border: '1px solid #3f51b5',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: '#c5cae9',
  },
  flightNum: {
    fontWeight: 700,
    color: '#90caf9',
    marginBottom: '2px',
  },
  flightTime: {
    fontSize: '11px',
    color: '#7986cb',
  },
  bookBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'linear-gradient(90deg, #1565c0 0%, #0d47a1 100%)',
    border: '1px solid #1976d2',
    borderRadius: '7px',
    color: '#fff',
    fontWeight: 700,
    fontSize: '13px',
    padding: '10px 18px',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'opacity 0.15s',
    alignSelf: 'flex-start',
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(57,73,171,0.3)',
    border: '1px solid #3949ab',
    borderRadius: '7px',
    color: '#90caf9',
    fontWeight: 600,
    fontSize: '12px',
    padding: '8px 14px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  drawerActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  copyConfirm: {
    fontSize: '11px',
    color: '#81c784',
    fontWeight: 600,
  },
  loadingWrap: {
    textAlign: 'center',
    padding: '80px 20px',
    color: '#5c6bc0',
    fontSize: '18px',
  },
  errorWrap: {
    textAlign: 'center',
    padding: '80px 20px',
    color: '#ef5350',
    fontSize: '16px',
  },
  emptyWrap: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#5c6bc0',
    fontSize: '15px',
  },
  blackoutList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  blackoutPip: {
    background: 'rgba(180,0,0,0.25)',
    border: '1px solid #c62828',
    borderRadius: '3px',
    padding: '1px 5px',
    fontSize: '10px',
    color: '#ef9a9a',
  },
  chevron: (expanded) => ({
    display: 'inline-block',
    marginLeft: 'auto',
    fontSize: '12px',
    color: '#5c6bc0',
    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s',
  }),
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function mayDates() {
  const dates = []
  for (let d = 1; d <= 31; d++) {
    dates.push(`2026-05-${String(d).padStart(2, '0')}`)
  }
  return dates
}

const ALL_MAY = mayDates()

function availableDates(route) {
  const blackoutSet = new Set(route.blackout || [])
  return ALL_MAY.filter((d) => !blackoutSet.has(d))
}

function fmtDate(iso) {
  const [, , dd] = iso.split('-')
  const dayOfWeek = DAYS[new Date(iso).getDay()]
  return `${dd} ${dayOfWeek}`
}

function fmtDateShort(iso) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatLastUpdated(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-SG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore',
    }) + ' SGT'
  } catch {
    return iso
  }
}

// ─── FlightCard Component ─────────────────────────────────────────────────────

function FlightCard({ route, schedules, expanded, onToggle }) {
  const [copied, setCopied] = useState(false)

  const avail = useMemo(() => availableDates(route), [route])
  const blackoutSet = useMemo(() => new Set(route.blackout || []), [route])

  const copyDeal = useCallback(
    (e) => {
      e.stopPropagation()
      const availStr = avail.slice(0, 10).map(fmtDateShort).join(', ')
      const moreStr = avail.length > 10 ? ` (+${avail.length - 10} more)` : ''
      const flightStr = route.flights.join(', ')
      const text =
        `[KrisFlyer Escapes May 2026]\n` +
        `${route.airline}: ${route.from} → ${route.to} | ${route.cabin}\n` +
        `Miles: ${route.miles.toLocaleString()} (${route.discount}% off)\n` +
        `Flights: ${flightStr}\n` +
        `Available: ${availStr}${moreStr}\n` +
        `Book by 30 Apr 2026 | ${BOOKING_URLS[route.airline]}`
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    },
    [route, avail]
  )

  return (
    <div style={S.card(expanded)} onClick={onToggle}>
      <div style={S.cardHeader}>
        {/* Top row: airline + cabin + chevron */}
        <div style={S.cardTop}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={S.airlineBadge(route.airline)}>{route.airline}</span>
            <span style={S.cabinBadge(route.cabin)}>{route.cabin}</span>
          </div>
          <span style={S.chevron(expanded)}>▼</span>
        </div>

        {/* Route */}
        <div style={S.routeRow}>
          <span style={S.cityText}>{route.from}</span>
          <span style={S.arrowText}>→</span>
          <span style={S.cityText}>{route.to}</span>
        </div>

        {/* Miles */}
        <div style={S.milesRow}>
          <span style={S.milesNum}>{route.miles.toLocaleString()}</span>
          <span style={S.milesLabel}>miles</span>
          <span style={S.discountBadge(route.discount)}>{route.discount}% off</span>
        </div>

        {/* Available date pills (first 8) */}
        <div>
          <div style={S.datesRow}>
            {ALL_MAY.slice(0, 15).map((d) => {
              const a = !blackoutSet.has(d)
              if (!a) return null
              return (
                <span key={d} style={S.datePip(true)}>{fmtDate(d)}</span>
              )
            })}
          </div>
          <div style={S.availCount}>{avail.length} available date{avail.length !== 1 ? 's' : ''} in May</div>
        </div>
      </div>

      {/* Expanded drawer */}
      {expanded && (
        <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
          {/* Flights with schedules */}
          <div style={S.drawerSection}>
            <div style={S.drawerLabel}>Flights</div>
            <div style={S.flightList}>
              {route.flights.map((fn) => {
                const sch = schedules[fn]
                return (
                  <div key={fn} style={S.flightChip}>
                    <div style={S.flightNum}>{fn}</div>
                    {sch && (
                      <div style={S.flightTime}>
                        {sch.dep} → {sch.arr} ({sch.dur})
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* All available dates */}
          <div style={S.drawerSection}>
            <div style={S.drawerLabel}>All Available Dates ({avail.length})</div>
            <div style={S.datesRow}>
              {avail.map((d) => (
                <span key={d} style={S.datePip(true)}>{fmtDate(d)}</span>
              ))}
            </div>
          </div>

          {/* Blackout dates */}
          {route.blackout && route.blackout.length > 0 && (
            <div style={S.drawerSection}>
              <div style={S.drawerLabel}>Blackout Dates ({route.blackout.length})</div>
              <div style={S.blackoutList}>
                {route.blackout.map((d) => (
                  <span key={d} style={S.blackoutPip}>{fmtDate(d)}</span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={S.drawerActions}>
            <a
              href={BOOKING_URLS[route.airline]}
              target="_blank"
              rel="noopener noreferrer"
              style={S.bookBtn}
              onClick={(e) => e.stopPropagation()}
            >
              Book on {route.airline === 'SQ' ? 'SingaporeAir' : 'Scoot'} →
            </a>
            <button style={S.copyBtn} onClick={copyDeal}>
              Copy deal
            </button>
            {copied && <span style={S.copyConfirm}>Copied!</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [citySearch, setCitySearch] = useState('')
  const [fromFilter, setFromFilter] = useState('All')
  const [toFilter, setToFilter] = useState('All')
  const [airlineFilter, setAirlineFilter] = useState('All')
  const [cabinFilter, setCabinFilter] = useState('All')
  const [activeDays, setActiveDays] = useState([]) // empty = all days
  const [specificDate, setSpecificDate] = useState('')
  const [flexDays, setFlexDays] = useState(0) // 0 = off
  const [minAvailDates, setMinAvailDates] = useState(1)
  const [sortBy, setSortBy] = useState('miles-asc')

  // Card expand state
  const [expandedId, setExpandedId] = useState(null)

  // Load data
  useEffect(() => {
    fetch('./data/flights.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  // Derived city lists
  const cities = useMemo(() => {
    if (!data) return { from: [], to: [] }
    const froms = [...new Set(data.routes.map((r) => r.from))].sort()
    const tos = [...new Set(data.routes.map((r) => r.to))].sort()
    return { from: froms, to: tos }
  }, [data])

  // Fuse search instance
  const fuse = useMemo(() => {
    if (!data) return null
    return new Fuse(data.routes, {
      keys: ['from', 'to'],
      threshold: 0.35,
      includeScore: true,
    })
  }, [data])

  // Filtered + sorted routes
  const filtered = useMemo(() => {
    if (!data) return []

    let routes = data.routes

    // Fuzzy city search across from+to
    if (citySearch.trim()) {
      const results = fuse.search(citySearch.trim())
      routes = results.map((r) => r.item)
    }

    // Dropdown from/to
    if (fromFilter !== 'All') routes = routes.filter((r) => r.from === fromFilter)
    if (toFilter !== 'All') routes = routes.filter((r) => r.to === toFilter)

    // Airline / cabin
    if (airlineFilter !== 'All') routes = routes.filter((r) => r.airline === airlineFilter)
    if (cabinFilter !== 'All') routes = routes.filter((r) => r.cabin === cabinFilter)

    // Day-of-week filter
    if (activeDays.length > 0) {
      routes = routes.filter((r) => {
        const avail = availableDates(r)
        return avail.some((d) => activeDays.includes(new Date(d).getDay()))
      })
    }

    // Specific date or flexible ±N days
    if (specificDate) {
      const base = new Date(specificDate)
      const candidates = new Set()
      if (flexDays > 0) {
        for (let offset = -flexDays; offset <= flexDays; offset++) {
          const dd = new Date(base)
          dd.setDate(dd.getDate() + offset)
          const iso = dd.toISOString().slice(0, 10)
          if (iso.startsWith('2026-05')) candidates.add(iso)
        }
      } else {
        candidates.add(specificDate)
      }
      routes = routes.filter((r) => {
        const avail = new Set(availableDates(r))
        return [...candidates].some((d) => avail.has(d))
      })
    }

    // Min available dates slider
    routes = routes.filter((r) => availableDates(r).length >= minAvailDates)

    // Sort
    routes = [...routes]
    if (sortBy === 'miles-asc') routes.sort((a, b) => a.miles - b.miles)
    else if (sortBy === 'miles-desc') routes.sort((a, b) => b.miles - a.miles)
    else if (sortBy === 'dest-az') routes.sort((a, b) => a.to.localeCompare(b.to))
    else if (sortBy === 'most-dates') routes.sort((a, b) => availableDates(b).length - availableDates(a).length)

    return routes
  }, [data, citySearch, fuse, fromFilter, toFilter, airlineFilter, cabinFilter,
    activeDays, specificDate, flexDays, minAvailDates, sortBy])

  const toggleDay = (d) => {
    setActiveDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  const cardId = (r) => `${r.airline}-${r.from}-${r.to}-${r.cabin}`

  const handleToggle = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const resetFilters = () => {
    setCitySearch('')
    setFromFilter('All')
    setToFilter('All')
    setAirlineFilter('All')
    setCabinFilter('All')
    setActiveDays([])
    setSpecificDate('')
    setFlexDays(0)
    setMinAvailDates(1)
    setSortBy('miles-asc')
  }

  // ── Render ──

  if (loading) {
    return (
      <div style={S.app}>
        <div style={S.loadingWrap}>Loading flight data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={S.app}>
        <div style={S.errorWrap}>
          Failed to load flight data: {error}
          <br />
          <small style={{ color: '#90a4ae', marginTop: '8px', display: 'block' }}>
            Make sure data/flights.json exists and the dev server is running.
          </small>
        </div>
      </div>
    )
  }

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.headerTitle}>KrisFlyer Spontaneous Escapes</h1>
          <div style={S.headerSub}>
            {data.meta.month} · Book by {data.meta.bookBy}
          </div>
        </div>
        <div style={S.lastUpdated}>
          Last updated:<br />
          <span style={{ color: '#90caf9' }}>{formatLastUpdated(data.meta.lastUpdated)}</span>
        </div>
      </div>

      {/* Filters */}
      <div style={S.filtersPanel}>
        {/* City search */}
        <div style={{ ...S.filterGroup, gridColumn: 'span 2' }}>
          <label style={S.label}>Search City (Fuzzy)</label>
          <input
            style={S.input}
            placeholder="e.g. Bali, Tokyo, Manila..."
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
          />
        </div>

        {/* From dropdown */}
        <div style={S.filterGroup}>
          <label style={S.label}>From</label>
          <select style={S.select} value={fromFilter} onChange={(e) => setFromFilter(e.target.value)}>
            <option value="All">All Origins</option>
            {cities.from.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* To dropdown */}
        <div style={S.filterGroup}>
          <label style={S.label}>To</label>
          <select style={S.select} value={toFilter} onChange={(e) => setToFilter(e.target.value)}>
            <option value="All">All Destinations</option>
            {cities.to.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Airline */}
        <div style={S.filterGroup}>
          <label style={S.label}>Airline</label>
          <select style={S.select} value={airlineFilter} onChange={(e) => setAirlineFilter(e.target.value)}>
            <option value="All">All Airlines</option>
            <option value="SQ">SQ — Singapore Airlines</option>
            <option value="TR">TR — Scoot</option>
          </select>
        </div>

        {/* Cabin */}
        <div style={S.filterGroup}>
          <label style={S.label}>Cabin</label>
          <select style={S.select} value={cabinFilter} onChange={(e) => setCabinFilter(e.target.value)}>
            <option value="All">All Cabins</option>
            <option value="Economy">Economy</option>
            <option value="Business">Business</option>
          </select>
        </div>

        {/* Day of week */}
        <div style={S.filterGroup}>
          <label style={S.label}>Day of Week</label>
          <div style={S.dayToggleRow}>
            {DAYS.map((day, i) => (
              <button key={day} style={S.dayBtn(activeDays.includes(i))} onClick={() => toggleDay(i)}>
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Specific date */}
        <div style={S.filterGroup}>
          <label style={S.label}>Specific Date</label>
          <input
            type="date"
            style={S.input}
            min="2026-05-01"
            max="2026-05-31"
            value={specificDate}
            onChange={(e) => setSpecificDate(e.target.value)}
          />
        </div>

        {/* Flexible ±days */}
        <div style={S.filterGroup}>
          <label style={S.label}>Flexible ± Days</label>
          <div style={S.flexModeRow}>
            {[0, 1, 2, 3].map((n) => (
              <button key={n} style={S.flexBtn(flexDays === n)} onClick={() => setFlexDays(n)}>
                {n === 0 ? 'Exact' : `±${n}`}
              </button>
            ))}
          </div>
        </div>

        {/* Min available dates */}
        <div style={S.filterGroup}>
          <label style={S.label}>Min Available Dates: <span style={{ color: '#ffd740' }}>{minAvailDates}</span></label>
          <div style={S.sliderWrap}>
            <input
              type="range"
              min={1}
              max={20}
              value={minAvailDates}
              style={S.slider}
              onChange={(e) => setMinAvailDates(Number(e.target.value))}
            />
            <span style={S.sliderVal}>{minAvailDates}</span>
          </div>
        </div>

        {/* Reset */}
        <div style={S.filterGroup}>
          <label style={S.label}>&nbsp;</label>
          <button
            style={{ ...S.copyBtn, alignSelf: 'flex-end', padding: '8px 16px', fontSize: '12px' }}
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={S.main}>
        <div style={S.statsBar}>
          <span style={S.statsBadge}>{filtered.length} route{filtered.length !== 1 ? 's' : ''} shown</span>
          <span style={S.statsBadge}>
            {filtered.filter((r) => r.airline === 'SQ').length} SQ
          </span>
          <span style={S.statsBadge}>
            {filtered.filter((r) => r.airline === 'TR').length} TR
          </span>
          <select style={S.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="miles-asc">Miles (low → high)</option>
            <option value="miles-desc">Miles (high → low)</option>
            <option value="dest-az">Destination A–Z</option>
            <option value="most-dates">Most dates available</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div style={S.emptyWrap}>
            No routes match your filters.{' '}
            <span
              style={{ color: '#5c6bc0', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={resetFilters}
            >
              Reset filters
            </span>
          </div>
        ) : (
          <div style={S.cardGrid}>
            {filtered.map((route) => {
              const id = cardId(route)
              return (
                <FlightCard
                  key={id}
                  route={route}
                  schedules={data.schedules}
                  expanded={expandedId === id}
                  onToggle={() => handleToggle(id)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
