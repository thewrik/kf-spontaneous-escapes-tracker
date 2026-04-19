import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import './App.css'

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
    background: 'var(--app-bg)',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: 'var(--text)',
  },
  header: {
    background: 'var(--header-bg)',
    borderBottom: '1px solid var(--header-border)',
  },
  headerTitle: { margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '0.5px', color: '#fff' },
  headerSub: { fontSize: '12px', color: '#90caf9', marginTop: '2px' },
  lastUpdated: { fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' },
  filtersPanel: {
    background: 'var(--panel-bg)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--panel-border)',
  },
  filterGroup: {},
  label: { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-accent)' },
  input: {
    background: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    background: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  dayToggleRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  dayBtn: (active) => ({
    background: active ? 'var(--btn-active-bg)' : 'var(--btn-bg)',
    border: `1px solid ${active ? 'var(--btn-active-border)' : 'var(--border)'}`,
    borderRadius: '5px',
    color: active ? 'var(--btn-active-color)' : 'var(--btn-color)',
    padding: '5px 8px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    minWidth: '36px',
    textAlign: 'center',
  }),
  flexModeRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  flexBtn: (active) => ({
    background: active ? 'var(--flex-active-bg)' : 'var(--btn-bg)',
    border: `1px solid ${active ? 'var(--flex-active-border)' : 'var(--border)'}`,
    borderRadius: '5px',
    color: active ? '#fff' : 'var(--btn-color)',
    padding: '5px 10px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  sliderWrap: { display: 'flex', alignItems: 'center', gap: '10px' },
  slider: { flex: 1, accentColor: 'var(--text-muted)', cursor: 'pointer' },
  sliderVal: { fontSize: '13px', fontWeight: 700, color: 'var(--text-accent)', minWidth: '20px', textAlign: 'right' },
  main: {},
  statsBar: {},
  statsBadge: {
    background: 'var(--badge-bg)',
    border: '1px solid var(--badge-border)',
    borderRadius: '20px',
    padding: '4px 14px',
    fontSize: '12px',
    color: 'var(--text-accent)',
  },
  sortSelect: {
    background: 'var(--sort-bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '6px 10px',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  cardGrid: {},
  card: (expanded) => ({
    background: expanded
      ? 'linear-gradient(135deg, var(--card-exp-from) 0%, var(--card-exp-to) 100%)'
      : 'linear-gradient(135deg, var(--card-from) 0%, var(--card-to) 100%)',
    border: `1px solid ${expanded ? '#1976d2' : 'var(--card-border)'}`,
    borderRadius: '10px',
    overflow: 'hidden',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: expanded ? '0 0 20px var(--card-shadow-exp)' : '0 2px 8px var(--card-shadow)',
    cursor: 'pointer',
  }),
  cardHeader: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
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
    background: cabin === 'Business' ? 'rgba(120,60,0,0.5)' : 'rgba(57,73,171,0.2)',
    border: `1px solid ${cabin === 'Business' ? '#f57c00' : 'var(--border)'}`,
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    color: cabin === 'Business' ? '#ffcc80' : 'var(--text-dim)',
  }),
  routeRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  cityText: { fontSize: '17px', fontWeight: 700, color: 'var(--text)' },
  arrowText: { fontSize: '16px', color: 'var(--text-muted)' },
  milesRow: { display: 'flex', alignItems: 'baseline', gap: '8px' },
  milesNum: { fontSize: '22px', fontWeight: 800, color: 'var(--miles-color)', lineHeight: 1 },
  milesLabel: { fontSize: '12px', color: 'var(--text-dim)' },
  discountBadge: () => ({
    background: 'rgba(46,125,50,0.4)',
    border: '1px solid #388e3c',
    borderRadius: '4px',
    padding: '2px 7px',
    fontSize: '11px',
    color: '#81c784',
    fontWeight: 700,
  }),
  datesRow: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' },
  datePip: () => ({
    background: 'rgba(46,125,50,0.35)',
    border: '1px solid #388e3c',
    borderRadius: '4px',
    padding: '2px 7px',
    fontSize: '10px',
    color: '#a5d6a7',
    fontWeight: 600,
  }),
  availCount: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' },
  drawer: {
    borderTop: '1px solid var(--drawer-border)',
    padding: '14px 16px',
    background: 'var(--drawer-bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  drawerSection: { display: 'flex', flexDirection: 'column', gap: '6px' },
  drawerLabel: { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' },
  flightList: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  flightChip: {
    background: 'var(--chip-bg)',
    border: '1px solid var(--chip-border)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: 'var(--chip-color)',
  },
  flightNum: { fontWeight: 700, color: 'var(--text-accent)', marginBottom: '2px' },
  flightTime: { fontSize: '11px', color: 'var(--text-muted)' },
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
    background: 'var(--copy-btn-bg)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    color: 'var(--copy-btn-color)',
    fontWeight: 600,
    fontSize: '12px',
    padding: '8px 14px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  drawerActions: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  copyConfirm: { fontSize: '11px', color: '#81c784', fontWeight: 600 },
  loadingWrap: { textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)', fontSize: '18px' },
  errorWrap: { textAlign: 'center', padding: '80px 20px', color: '#ef5350', fontSize: '16px' },
  emptyWrap: { textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: '15px' },
  blackoutList: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
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
    color: 'var(--text-muted)',
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

// ─── CityInput Component ──────────────────────────────────────────────────────

function CityInput({ value, onChange, placeholder, iataMap }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!value) { setQuery(''); return }
    const iata = iataMap[value]
    setQuery(iata ? `${value} (${iata})` : value)
  }, [value, iataMap])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const matches = useMemo(() => {
    const q = query.replace(/\s*\(.*\)\s*$/, '').toLowerCase().trim()
    const entries = Object.entries(iataMap)
    if (!q) return entries.map(([name, iata]) => ({ name, iata }))
    return entries
      .filter(([name, iata]) => name.toLowerCase().includes(q) || iata.toLowerCase().includes(q))
      .map(([name, iata]) => ({ name, iata }))
  }, [query, iataMap])

  const select = (name, iata) => {
    setQuery(iata ? `${name} (${iata})` : name)
    onChange(name)
    setOpen(false)
  }

  const handleChange = (e) => {
    const raw = e.target.value
    setQuery(raw)
    onChange(raw.replace(/\s*\(.*\)\s*$/, '').trim())
    setOpen(true)
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...S.input, paddingRight: query ? '28px' : '12px' }}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button
            onMouseDown={(e) => { e.preventDefault(); setQuery(''); onChange(''); setOpen(false) }}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#7986cb', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1 }}
          >×</button>
        )}
      </div>
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)', borderRadius: '6px', zIndex: 200, overflowY: 'auto', maxHeight: '220px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {matches.map(({ name, iata }) => (
            <div
              key={`${name}-${iata}`}
              onMouseDown={() => select(name, iata)}
              style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#e8eaf6', borderBottom: '1px solid rgba(57,73,171,0.25)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(57,73,171,0.35)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>{name}</span>
              <span style={{ color: '#90caf9', fontWeight: 700, fontFamily: 'monospace', fontSize: '12px' }}>{iata}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MonthCalendar + DatePickerField Components ───────────────────────────────

const MAY_FIRST_DOW = new Date('2026-05-01').getDay() // 5 = Friday

function MonthCalendar({ selected, onChange }) {
  const cells = [
    ...Array(MAY_FIRST_DOW).fill(null),
    ...Array.from({ length: 31 }, (_, i) => i + 1),
  ]
  return (
    <div style={{ background: 'var(--calendar-bg)', border: '1px solid var(--border)', borderRadius: '8px 8px 0 0', padding: '12px' }}>
      <div style={{ textAlign: 'center', fontWeight: 700, color: '#90caf9', marginBottom: '10px', fontSize: '13px', letterSpacing: '0.5px' }}>
        May 2026
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ fontSize: '10px', color: '#7986cb', padding: '3px 0', fontWeight: 600 }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const iso = `2026-05-${String(d).padStart(2, '0')}`
          const sel = selected === iso
          return (
            <div
              key={d}
              onMouseDown={() => onChange(sel ? '' : iso)}
              style={{ padding: '6px 2px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: sel ? 700 : 400, background: sel ? '#1976d2' : 'transparent', color: sel ? '#fff' : '#e8eaf6', border: sel ? '1px solid #42a5f5' : '1px solid transparent', userSelect: 'none' }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'rgba(57,73,171,0.35)' }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
            >{d}</div>
          )
        })}
      </div>
    </div>
  )
}

function DatePickerField({ selected, onChange, flexDays, onFlexChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const display = selected
    ? new Date(selected + 'T12:00:00').toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
    : ''

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <div style={{ position: 'relative' }}>
        <input
          readOnly
          style={{ ...S.input, cursor: 'pointer', paddingRight: selected ? '28px' : '12px' }}
          placeholder="Any date in May"
          value={display}
          onMouseDown={() => setOpen(o => !o)}
        />
        {selected && (
          <button
            onMouseDown={(e) => { e.preventDefault(); onChange(''); onFlexChange(0) }}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#7986cb', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1 }}
          >×</button>
        )}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', borderRadius: '8px', minWidth: '240px' }}>
          <MonthCalendar selected={selected} onChange={(d) => { onChange(d) }} />
          <div style={{ background: 'var(--calendar-bg)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px' }}>
            <div style={{ ...S.label, marginBottom: '6px' }}>Flexible ±</div>
            <div style={S.flexModeRow}>
              {[0, 1, 2, 3].map(n => (
                <button key={n} style={S.flexBtn(flexDays === n)} onMouseDown={() => onFlexChange(n)}>
                  {n === 0 ? 'Exact' : `±${n}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
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

  const [theme, setTheme] = useState('night')

  // Filter state
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
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

  // IATA map: city name → IATA code (from data + any route cities not in dict)
  const iataMap = useMemo(() => {
    if (!data) return {}
    const map = { ...data.iata }
    for (const r of data.routes) {
      if (!map[r.from]) map[r.from] = ''
      if (!map[r.to]) map[r.to] = ''
    }
    return map
  }, [data])

  // Filtered + sorted routes
  const filtered = useMemo(() => {
    if (!data) return []

    let routes = data.routes

    // Text from/to (case-insensitive substring match)
    if (fromFilter.trim()) routes = routes.filter((r) => r.from.toLowerCase().includes(fromFilter.trim().toLowerCase()))
    if (toFilter.trim()) routes = routes.filter((r) => r.to.toLowerCase().includes(toFilter.trim().toLowerCase()))

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
  }, [data, fromFilter, toFilter, airlineFilter, cabinFilter,
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
    setFromFilter('')
    setToFilter('')
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
      <div style={S.app} data-theme={theme}>
        <div style={S.loadingWrap}>Loading flight data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={S.app} data-theme={theme}>
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
    <div style={S.app} data-theme={theme}>
      {/* Header */}
      <div style={S.header} className="app-header">
        <div>
          <h1 style={S.headerTitle}>KrisFlyer Spontaneous Escapes</h1>
          <div style={S.headerSub}>
            {data.meta.month} · Book by {data.meta.bookBy}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={S.lastUpdated}>
            Last updated:<br />
            <span style={{ color: '#90caf9' }}>{formatLastUpdated(data.meta.lastUpdated)}</span>
          </div>
          <button
            onClick={() => setTheme(t => t === 'night' ? 'day' : 'night')}
            title={theme === 'night' ? 'Switch to day mode' : 'Switch to night mode'}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: '#fff', fontSize: '18px', padding: '6px 10px', cursor: 'pointer', lineHeight: 1 }}
          >
            {theme === 'night' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={S.filtersPanel} className="filters-panel">
        {/* From / swap / To */}
        <div className="filter-from-to">
          <div className="filter-group" style={{ flex: 1 }}>
            <label style={S.label}>From</label>
            <CityInput value={fromFilter} onChange={setFromFilter} placeholder="City or IATA" iataMap={iataMap} />
          </div>
          <button
            className="swap-btn"
            title="Swap"
            style={{ background: 'rgba(57,73,171,0.3)', border: '1px solid #3949ab', borderRadius: '6px', color: '#90caf9', fontSize: '16px', padding: '7px 10px', cursor: 'pointer' }}
            onClick={() => { setFromFilter(toFilter); setToFilter(fromFilter) }}
          >⇄</button>
          <div className="filter-group" style={{ flex: 1 }}>
            <label style={S.label}>To</label>
            <CityInput value={toFilter} onChange={setToFilter} placeholder="City or IATA" iataMap={iataMap} />
          </div>
        </div>

        {/* Airline */}
        <div className="filter-group">
          <label style={S.label}>Airline</label>
          <div style={S.dayToggleRow}>
            {['All', 'SQ', 'TR'].map((a) => (
              <button key={a} style={S.dayBtn(airlineFilter === a)} onClick={() => setAirlineFilter(a)}>
                {a === 'All' ? 'All' : a}
              </button>
            ))}
          </div>
        </div>

        {/* Cabin */}
        <div className="filter-group">
          <label style={S.label}>Cabin</label>
          <div style={S.dayToggleRow}>
            {['All', 'Economy', 'Business'].map((c) => (
              <button key={c} style={S.dayBtn(cabinFilter === c)} onClick={() => setCabinFilter(c)}>
                {c === 'All' ? 'All' : c === 'Economy' ? 'Eco' : 'Biz'}
              </button>
            ))}
          </div>
        </div>

        {/* Day of week */}
        <div className="filter-group filter-days">
          <label style={S.label}>Day of Week</label>
          <div style={S.dayToggleRow}>
            {DAYS.map((day, i) => (
              <button key={day} style={S.dayBtn(activeDays.includes(i))} onClick={() => toggleDay(i)}>
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Date picker */}
        <div className="filter-group filter-date">
          <label style={S.label}>Date</label>
          <DatePickerField
            selected={specificDate}
            onChange={setSpecificDate}
            flexDays={flexDays}
            onFlexChange={setFlexDays}
          />
        </div>

        {/* Min available dates */}
        <div className="filter-group filter-slider">
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
        <div className="filter-reset">
          <button
            style={{ ...S.copyBtn, padding: '8px 16px', fontSize: '12px' }}
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        <div className="stats-bar">
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
          <div className="card-grid">
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
