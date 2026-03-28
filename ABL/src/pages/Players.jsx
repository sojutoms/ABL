import React, { useEffect, useState, useRef } from 'react'
import { getPlayers, getTeams, createPlayer, updatePlayer, deletePlayer } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

const POSITIONS = ['PG','SG','SF','PF','C','G','F','G/F','F/C']

// Generate avatar initials placeholder
const Avatar = ({ player, size = 48 }) => {
  const initials = `${player.firstName?.[0] || ''}${player.lastName?.[0] || ''}`.toUpperCase()
  if (player.photo) {
    return (
      <img
        src={player.photo}
        alt={`${player.firstName} ${player.lastName}`}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--black-5)', border: '2px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 800,
      fontSize: size * 0.3 + 'px', color: 'var(--gold)', flexShrink: 0,
    }}>{initials}</div>
  )
}

const PlayerModal = ({ teams, onClose, onSaved, existing }) => {
  const { addToast } = useToast()
  const fileRef = useRef()
  const [form, setForm] = useState(existing ? {
    ...existing,
    team: existing.team?._id || existing.team,
  } : {
    firstName: '', lastName: '', jerseyNumber: '', position: 'PG',
    team: '', height: '', weight: '', age: '', photo: '',
  })
  const [preview, setPreview] = useState(existing?.photo || '')
  const [saving, setSaving]   = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Handle local file → base64 preview (stored as data URL in photo field)
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { addToast('Image must be under 2MB', 'error'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target.result)
      set('photo', ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.team || !form.position) {
      addToast('First name, last name, team and position are required', 'error'); return
    }
    setSaving(true)
    try {
      if (existing) await updatePlayer(existing._id, form)
      else await createPlayer(form)
      addToast(existing ? 'Player updated!' : 'Player added!', 'success')
      onSaved()
    } catch (e) {
      addToast(e.response?.data?.message || 'Error saving player', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <span className="modal-title">{existing ? 'Edit Player' : 'Add Player'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body flex-col gap-16">

          {/* Photo upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              {preview
                ? <img src={preview} alt="preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--gold)' }} />
                : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--black-5)', border: '3px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--w30)' }}>👤</div>
              }
              <button onClick={() => fileRef.current.click()}
                style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--gold)', color: 'var(--black)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', fontWeight: 800 }}>
                ✎
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', marginBottom: 4 }}>Player Photo</div>
              <div className="muted small" style={{ marginBottom: 8 }}>Upload a photo (JPG/PNG, max 2MB)</div>
              <button className="btn btn-outline btn-sm" onClick={() => fileRef.current.click()}>
                📷 Upload Photo
              </button>
              {preview && (
                <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => { setPreview(''); set('photo', '') }}>
                  Remove
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            </div>
          </div>

          {/* URL alternative */}
          <div className="form-group">
            <label className="form-label">Or Photo URL</label>
            <input className="form-input" placeholder="https://..." value={form.photo?.startsWith('data:') ? '' : (form.photo || '')}
              onChange={e => { set('photo', e.target.value); setPreview(e.target.value) }} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input className="form-input" placeholder="e.g. Miguel" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input className="form-input" placeholder="e.g. Santos" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Team *</label>
              <select className="form-input" value={form.team} onChange={e => set('team', e.target.value)}>
                <option value="">Select team</option>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name} ({t.abbreviation})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Position *</label>
              <select className="form-input" value={form.position} onChange={e => set('position', e.target.value)}>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Jersey # *</label>
              <input type="number" className="form-input" placeholder="23" value={form.jerseyNumber} onChange={e => set('jerseyNumber', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Age</label>
              <input type="number" className="form-input" placeholder="24" value={form.age || ''} onChange={e => set('age', e.target.value)} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Height</label>
              <input className="form-input" placeholder='6&apos;2"' value={form.height || ''} onChange={e => set('height', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Weight (lbs)</label>
              <input type="number" className="form-input" placeholder="185" value={form.weight || ''} onChange={e => set('weight', e.target.value)} />
            </div>
          </div>

        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Player'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Players() {
  const { addToast } = useToast()
  const [players, setPlayers] = useState([])
  const [teams, setTeams]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [teamFilter, setTeamFilter] = useState('all')
  const [search, setSearch]   = useState('')

  const load = async () => {
    const [p, t] = await Promise.all([getPlayers(), getTeams()])
    setPlayers(p.data.data)
    setTeams(t.data.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (player) => {
    if (!confirm(`Remove ${player.firstName} ${player.lastName} from roster?`)) return
    try {
      await deletePlayer(player._id)
      addToast('Player removed', 'info')
      load()
    } catch { addToast('Failed to remove player', 'error') }
  }

  const filtered = players
    .filter(p => teamFilter === 'all' || (p.team?._id || p.team) === teamFilter)
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.position?.toLowerCase().includes(q) ||
        String(p.jerseyNumber).includes(q)
    })

  // Group by team
  const grouped = {}
  filtered.forEach(p => {
    const key = p.team?.name || 'Unknown'
    if (!grouped[key]) grouped[key] = { team: p.team, players: [] }
    grouped[key].players.push(p)
  })

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Players</h1>
        <button className="btn btn-gold" onClick={() => setModal('create')}>+ Add Player</button>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input" placeholder="🔍 Search player..."
            style={{ width: 220 }} value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setTeamFilter('all')} className={`btn btn-sm ${teamFilter === 'all' ? 'btn-gold' : 'btn-outline'}`}>All Teams</button>
            {teams.map(t => (
              <button key={t._id} onClick={() => setTeamFilter(t._id)} className={`btn btn-sm ${teamFilter === t._id ? 'btn-gold' : 'btn-outline'}`}>{t.abbreviation}</button>
            ))}
          </div>
        </div>

        {loading
          ? <div className="card"><div className="skeleton" style={{ height: 300 }} /></div>
          : filtered.length === 0
            ? <div className="card" style={{ textAlign:'center', padding: 60, color: 'var(--w30)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>👤</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', fontWeight:700, marginBottom:6 }}>No Players Found</div>
                <div className="muted small">Add players to get started.</div>
              </div>
            : Object.entries(grouped).map(([teamName, { team, players: tPlayers }]) => (
                <div key={teamName} style={{ marginBottom: 28 }}>
                  {/* Team header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: team?.primaryColor || '#666', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{teamName}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', color: 'var(--w30)', textTransform: 'uppercase' }}>{tPlayers.length} players</span>
                  </div>

                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Photo</th>
                          <th>#</th>
                          <th>Name</th>
                          <th>Pos</th>
                          <th>Ht</th>
                          <th>Wt</th>
                          <th>Age</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tPlayers
                          .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
                          .map(player => (
                            <tr key={player._id}>
                              <td><Avatar player={player} size={38} /></td>
                              <td>
                                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--gold)' }}>
                                  {player.jerseyNumber}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{player.firstName} {player.lastName}</div>
                              </td>
                              <td>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 700, background: 'var(--black-5)', padding: '2px 7px', borderRadius: 4, color: 'var(--w80)' }}>
                                  {player.position}
                                </span>
                              </td>
                              <td className="muted small">{player.height || '—'}</td>
                              <td className="muted small">{player.weight ? `${player.weight} lbs` : '—'}</td>
                              <td className="muted small">{player.age || '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button className="btn btn-outline btn-sm" onClick={() => setModal(player)}>Edit</button>
                                  <button className="btn btn-red btn-sm" onClick={() => handleDelete(player)}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
        }
      </div>

      {modal && (
        <PlayerModal
          teams={teams}
          existing={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}