import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGames, getTeams, createGame, updateGame, deleteGame } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

const STATUSES = ['scheduled','live','final']

const GameModal = ({ teams, onClose, onSaved, existing }) => {
  const { addToast } = useToast()
  const [form, setForm] = useState(existing || {
    homeTeam: '', awayTeam: '', scheduledDate: '', venue: '',
    season: '2025', round: 'Regular Season', gameNumber: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.homeTeam || !form.awayTeam || !form.scheduledDate) {
      addToast('Please fill in all required fields', 'error'); return
    }
    if (form.homeTeam === form.awayTeam) {
      addToast('Home and away teams must be different', 'error'); return
    }
    setSaving(true)
    try {
      if (existing) await updateGame(existing._id, form)
      else await createGame(form)
      addToast(existing ? 'Game updated!' : 'Game created!', 'success')
      onSaved()
    } catch (e) {
      addToast(e.response?.data?.message || 'Error saving game', 'error')
    } finally { setSaving(false) }
  }

  // Format date for datetime-local input
  const toInputDate = (d) => {
    if (!d) return ''
    return new Date(d).toISOString().slice(0, 16)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{existing ? 'Edit Game' : 'New Game'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body flex-col gap-16">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Away Team *</label>
              <select className="form-input" value={form.awayTeam?._id || form.awayTeam} onChange={e => set('awayTeam', e.target.value)}>
                <option value="">Select team</option>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name} ({t.abbreviation})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Home Team *</label>
              <select className="form-input" value={form.homeTeam?._id || form.homeTeam} onChange={e => set('homeTeam', e.target.value)}>
                <option value="">Select team</option>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name} ({t.abbreviation})</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Date & Time *</label>
            <input type="datetime-local" className="form-input" value={toInputDate(form.scheduledDate)} onChange={e => set('scheduledDate', e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Venue</label>
              <input type="text" className="form-input" placeholder="e.g. Mall of Asia Arena" value={form.venue || ''} onChange={e => set('venue', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Game #</label>
              <input type="number" className="form-input" placeholder="1" value={form.gameNumber || ''} onChange={e => set('gameNumber', e.target.value)} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Season</label>
              <input type="text" className="form-input" value={form.season || '2025'} onChange={e => set('season', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Round</label>
              <input type="text" className="form-input" placeholder="Regular Season" value={form.round || ''} onChange={e => set('round', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Game'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Games() {
  const { addToast } = useToast()
  const [games, setGames]     = useState([])
  const [teams, setTeams]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null) // null | 'create' | game object
  const [filter, setFilter]   = useState('all')

  const load = async () => {
    const [g, t] = await Promise.all([getGames(), getTeams()])
    setGames(g.data.data)
    setTeams(t.data.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (game) => {
    if (!confirm(`Delete game: ${game.awayTeam?.abbreviation} vs ${game.homeTeam?.abbreviation}?`)) return
    try {
      await deleteGame(game._id)
      addToast('Game deleted', 'info')
      load()
    } catch { addToast('Failed to delete', 'error') }
  }

  const handleStatusChange = async (game, status) => {
    try {
      await updateGame(game._id, { status })
      addToast(`Status → ${status}`, 'success')
      load()
    } catch { addToast('Failed to update status', 'error') }
  }

  const filtered = filter === 'all' ? games : games.filter(g => g.status === filter)
  const sorted   = [...filtered].sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Games</h1>
        <button className="btn btn-gold" onClick={() => setModal('create')}>+ New Game</button>
      </div>

      <div className="page-body">
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`btn btn-sm ${filter === s ? 'btn-gold' : 'btn-outline'}`}
              style={{ textTransform: 'capitalize' }}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Status</th><th>Date</th><th>Matchup</th>
                <th>Score</th><th>Venue</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [1,2,3,4].map(k => (
                    <tr key={k}>{[1,2,3,4,5,6,7].map(j => <td key={j}><div className="skeleton" style={{ height: 14, width: j===4?120:60 }} /></td>)}</tr>
                  ))
                : sorted.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--w30)', padding:40 }}>No games found.</td></tr>
                  : sorted.map(game => (
                      <tr key={game._id}>
                        <td className="muted small">{game.gameNumber || '—'}</td>
                        <td>
                          <select
                            value={game.status}
                            onChange={e => handleStatusChange(game, e.target.value)}
                            style={{ background:'var(--black-4)', border:'1px solid var(--border)', color: game.status==='live'?'var(--red)':game.status==='final'?'var(--w60)':'var(--gold)', borderRadius:'var(--radius)', padding:'3px 8px', fontSize:'0.72rem', fontFamily:'var(--font-display)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer' }}
                          >
                            {STATUSES.map(s => <option key={s} value={s} style={{ color:'var(--white)' }}>{s}</option>)}
                          </select>
                        </td>
                        <td className="small">{new Date(game.scheduledDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</td>
                        <td>
                          <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.95rem' }}>
                            {game.awayTeam?.abbreviation || '?'} <span className="muted">@</span> {game.homeTeam?.abbreviation || '?'}
                          </div>
                          <div className="muted small">{game.round} · {game.venue}</div>
                        </td>
                        <td style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.05rem' }}>
                          {game.status !== 'scheduled' ? `${game.awayScore} – ${game.homeScore}` : '—'}
                          {game.status === 'live' && (
                            <div style={{ fontSize:'0.65rem', color:'var(--red)', fontFamily:'var(--font-display)', fontWeight:700 }}>
                              Q{game.currentQuarter} {game.gameClock}
                            </div>
                          )}
                        </td>
                        <td className="muted small">{game.venue || '—'}</td>
                        <td>
                          <div style={{ display:'flex', gap:6 }}>
                            <Link to={`/games/${game._id}/score`} className="btn btn-gold btn-sm">Score</Link>
                            <button className="btn btn-outline btn-sm" onClick={() => setModal(game)}>Edit</button>
                            <button className="btn btn-red btn-sm" onClick={() => handleDelete(game)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <GameModal
          teams={teams}
          existing={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}