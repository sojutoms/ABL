import React, { useEffect, useState } from 'react'
import { getTeams, createTeam, updateTeam } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

const COLORS = ['#1d4ed8','#dc2626','#16a34a','#7c3aed','#ea580c','#0891b2','#be185d','#65a30d']

const TeamModal = ({ onClose, onSaved, existing }) => {
  const { addToast } = useToast()
  const [form, setForm] = useState(existing || {
    name: '', abbreviation: '', city: '',
    primaryColor: '#1d4ed8', secondaryColor: '#ffffff',
    logo: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.abbreviation || !form.city) {
      addToast('Name, abbreviation and city are required', 'error'); return
    }
    setSaving(true)
    try {
      if (existing) await updateTeam(existing._id, form)
      else await createTeam(form)
      addToast(existing ? 'Team updated!' : 'Team created!', 'success')
      onSaved()
    } catch (e) {
      addToast(e.response?.data?.message || 'Error saving team', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{existing ? 'Edit Team' : 'New Team'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body flex-col gap-16">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Team Name *</label>
              <input className="form-input" placeholder="e.g. Ballers" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Abbreviation *</label>
              <input className="form-input" placeholder="e.g. BAL" maxLength={5} value={form.abbreviation} onChange={e => set('abbreviation', e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">City *</label>
            <input className="form-input" placeholder="e.g. Manila" value={form.city} onChange={e => set('city', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Logo URL</label>
            <input className="form-input" placeholder="https://..." value={form.logo || ''} onChange={e => set('logo', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Primary Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => set('primaryColor', c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.primaryColor === c ? '3px solid var(--white)' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
              <input type="color" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%' }} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Secondary Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {['#ffffff','#000000','#fbbf24','#f87171','#6ee7b7'].map(c => (
                <button key={c} onClick={() => set('secondaryColor', c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.secondaryColor === c ? '3px solid var(--gold)' : '2px solid var(--border)', cursor: 'pointer' }} />
              ))}
              <input type="color" value={form.secondaryColor} onChange={e => set('secondaryColor', e.target.value)}
                style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Team'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Teams() {
  const [teams, setTeams]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)

  const load = () => getTeams().then(r => { setTeams(r.data.data); setLoading(false) })
  useEffect(() => { load() }, [])

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Teams</h1>
        <button className="btn btn-gold" onClick={() => setModal('create')}>+ New Team</button>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {loading
            ? [1,2,3,4].map(k => <div key={k} className="card"><div className="skeleton" style={{ height: 100 }} /></div>)
            : teams.length === 0
              ? <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--w30)' }}>No teams yet.</div>
              : teams.map(team => (
                  <div key={team._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Color banner */}
                    <div style={{ height: 6, background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})` }} />
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        {team.logo
                          ? <img src={team.logo} alt={team.name} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                          : <div style={{ width: 44, height: 44, borderRadius: '50%', background: team.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>{team.abbreviation}</div>
                        }
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', textTransform: 'uppercase' }}>{team.name}</div>
                          <div className="muted small">{team.city} · {team.abbreviation}</div>
                        </div>
                      </div>
                      {/* Record */}
                      <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                        {[['W', team.wins, 'var(--green)'], ['L', team.losses, 'var(--red)'], ['Home', `${team.homeWins}-${team.homeLosses}`, 'var(--w60)'], ['Away', `${team.awayWins}-${team.awayLosses}`, 'var(--w60)']].map(([l, v, c]) => (
                          <div key={l} style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: c }}>{v}</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', color: 'var(--w30)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
                          </div>
                        ))}
                      </div>
                      <button className="btn btn-outline btn-sm w-full" onClick={() => setModal(team)}>Edit Team</button>
                    </div>
                  </div>
                ))
          }
        </div>
      </div>

      {modal && (
        <TeamModal
          existing={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}