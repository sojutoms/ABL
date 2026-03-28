import React from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext.jsx'
import Dashboard   from './pages/Dashboard.jsx'
import Games       from './pages/Games.jsx'
import LiveScorer  from './pages/LiveScorer.jsx'
import Teams       from './pages/Teams.jsx'
import Players     from './pages/Players.jsx'
import ManageGame  from './pages/ManageGame.jsx'

const NAV = [
  { to: '/',        label: 'Dashboard', icon: '⬛' },
  { to: '/games',   label: 'Games',     icon: '🏀' },
  { to: '/teams',   label: 'Teams',     icon: '🛡️'  },
  { to: '/players', label: 'Players',   icon: '👤' },
]

const Sidebar = () => {
  const loc = useLocation()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'var(--gold)', color: 'var(--black)',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: '1.1rem', padding: '4px 9px', borderRadius: 4, lineHeight: 1
          }}>ABL</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--w80)' }}>SCORER</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>★ DASHBOARD</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, marginBottom: 2,
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.07em',
              color: isActive ? 'var(--gold)' : 'var(--w60)',
              background: isActive ? 'var(--gold-glow)' : 'transparent',
              transition: 'all 0.18s ease',
              textDecoration: 'none',
            })}
          >
            <span style={{ fontSize: '1rem' }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--w30)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          ABL Scorer v1.0
        </div>
      </div>
    </aside>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/"               element={<Dashboard />} />
              <Route path="/games"          element={<Games />} />
              <Route path="/games/:gameId/score" element={<LiveScorer />} />
              <Route path="/games/:gameId/manage" element={<ManageGame />} />
              <Route path="/teams"          element={<Teams />} />
              <Route path="/players"        element={<Players />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ToastProvider>
  )
}