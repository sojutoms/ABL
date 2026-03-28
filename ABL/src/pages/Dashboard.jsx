import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGames, getTeams } from '../services/api.js'

const StatBox = ({ label, value, sub, color }) => (
  <div className="card" style={{ textAlign: 'center' }}>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2.4rem', color: color || 'var(--white)', lineHeight: 1 }}>{value}</div>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--w60)', marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: '0.72rem', color: 'var(--w30)', marginTop: 2 }}>{sub}</div>}
  </div>
)

const GameRow = ({ game }) => {
  const isLive  = game.status === 'live'
  const isFinal = game.status === 'final'

  return (
    <tr>
      <td>
        {isLive  && <span className="badge badge-live"><span className="live-dot" />Live</span>}
        {isFinal && <span className="badge badge-final">Final</span>}
        {!isLive && !isFinal && <span className="badge badge-sched">Sched</span>}
      </td>
      <td>
        <div style={{ fontWeight: 600 }}>
          {game.awayTeam?.abbreviation} <span className="muted">vs</span> {game.homeTeam?.abbreviation}
        </div>
        <div className="muted small">{new Date(game.scheduledDate).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</div>
      </td>
      <td>
        {game.status !== 'scheduled'
          ? <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>{game.awayScore} – {game.homeScore}</span>
          : <span className="muted">—</span>}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          {(isLive || game.status === 'scheduled') && (
            <Link to={`/games/${game._id}/score`} className="btn btn-gold btn-sm">Score</Link>
          )}
          <Link to={`/games/${game._id}/manage`} className="btn btn-outline btn-sm">Edit</Link>
        </div>
      </td>
    </tr>
  )
}

export default function Dashboard() {
  const [games, setGames]   = useState([])
  const [teams, setTeams]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getGames(), getTeams()])
      .then(([g, t]) => { setGames(g.data.data); setTeams(t.data.data) })
      .finally(() => setLoading(false))
  }, [])

  const live      = games.filter(g => g.status === 'live')
  const scheduled = games.filter(g => g.status === 'scheduled')
  const final     = games.filter(g => g.status === 'final')
  const recent    = [...games].sort((a,b) => new Date(b.scheduledDate) - new Date(a.scheduledDate)).slice(0, 6)

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/games" className="btn btn-outline">+ New Game</Link>
          <Link to="/players" className="btn btn-gold">Manage Roster</Link>
        </div>
      </div>

      <div className="page-body">
        {/* Stats row */}
        <div className="grid-3 mb-16" style={{ gap: 12 }}>
          <StatBox label="Live Now"  value={loading ? '—' : live.length}      color="var(--red)"   sub={live.length > 0 ? 'Game in progress' : 'No active games'} />
          <StatBox label="Scheduled" value={loading ? '—' : scheduled.length} color="var(--gold)"  sub="Upcoming games" />
          <StatBox label="Teams"     value={loading ? '—' : teams.length}      color="var(--green)" sub="In the league" />
        </div>

        {/* Live games alert */}
        {live.length > 0 && (
          <div style={{ background: 'var(--red-glow)', border: '1px solid var(--red)', borderRadius: 'var(--radius-lg)', padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="live-dot" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {live.length} Game{live.length > 1 ? 's' : ''} Currently Live
              </span>
            </div>
            <Link to={`/games/${live[0]._id}/score`} className="btn btn-red btn-sm">Open Scorer →</Link>
          </div>
        )}

        {/* Recent games table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Games</span>
            <Link to="/games" style={{ fontSize: '0.78rem', color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>View All →</Link>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Status</th><th>Matchup</th><th>Score</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [1,2,3].map(k => (
                    <tr key={k}>
                      {[1,2,3,4].map(j => (
                        <td key={j}><div className="skeleton" style={{ height: 14, width: j===2?120:60 }} /></td>
                      ))}
                    </tr>
                  ))
                : recent.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--w30)', padding: 32 }}>No games yet. Create your first game!</td></tr>
                  : recent.map(g => <GameRow key={g._id} game={g} />)
              }
            </tbody>
          </table>
        </div>

        {/* Quick links */}
        <div className="grid-3 mt-16" style={{ gap: 12 }}>
          {[
            { to: '/games',   icon: '📅', title: 'Schedule Game',  sub: 'Add a new game to the calendar' },
            { to: '/teams',   icon: '🛡️',  title: 'Manage Teams',  sub: 'Edit rosters and team info' },
            { to: '/players', icon: '👤', title: 'Add Players',    sub: 'Register players to teams' },
          ].map(item => (
            <Link key={item.to} to={item.to} className="card" style={{ display: 'block', transition: 'border-color 0.18s ease, transform 0.18s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-gold)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase', marginBottom: 4 }}>{item.title}</div>
              <div className="muted small">{item.sub}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}