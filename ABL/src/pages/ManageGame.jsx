import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGameById, updateGame, getTeams } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

export default function ManageGame() {
  const { gameId } = useParams()
  const { addToast } = useToast()
  const [game, setGame]   = useState(null)
  const [teams, setTeams] = useState([])
  const [form, setForm]   = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getGameById(gameId), getTeams()]).then(([g, t]) => {
      const gd = g.data.data
      setGame(gd)
      setTeams(t.data.data)
      setForm({
        homeTeam: gd.homeTeam?._id || gd.homeTeam,
        awayTeam: gd.awayTeam?._id || gd.awayTeam,
        homeScore: gd.homeScore, awayScore: gd.awayScore,
        homeTeamFouls: gd.homeTeamFouls, awayTeamFouls: gd.awayTeamFouls,
        status: gd.status, currentQuarter: gd.currentQuarter,
        gameClock: gd.gameClock, isOvertime: gd.isOvertime,
        homeQuarterScores: gd.homeQuarterScores || {q1:0,q2:0,q3:0,q4:0,ot:0},
        awayQuarterScores: gd.awayQuarterScores || {q1:0,q2:0,q3:0,q4:0,ot:0},
        scheduledDate: gd.scheduledDate, venue: gd.venue,
        round: gd.round, season: gd.season, gameNumber: gd.gameNumber,
        broadcastChannel: gd.broadcastChannel, notes: gd.notes,
      })
    })
  }, [gameId])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setQ = (team, q, v) => setForm(f => ({
    ...f,
    [`${team}QuarterScores`]: { ...f[`${team}QuarterScores`], [q]: parseInt(v)||0 }
  }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateGame(gameId, form)
      addToast('Game updated!', 'success')
    } catch (e) {
      addToast(e.response?.data?.message || 'Error saving', 'error')
    } finally { setSaving(false) }
  }

  if (!form) return <div style={{ padding:40 }}><div className="skeleton" style={{ height:400 }} /></div>

  const toInputDate = (d) => d ? new Date(d).toISOString().slice(0,16) : ''

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/games" style={{ color:'var(--w30)', fontSize:'0.78rem', fontFamily:'var(--font-display)', textTransform:'uppercase', letterSpacing:'0.08em' }}>← Games</Link>
          <h1 className="page-title" style={{ marginTop:4 }}>
            {game?.awayTeam?.abbreviation} @ {game?.homeTeam?.abbreviation} — Edit
          </h1>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link to={`/games/${gameId}/score`} className="btn btn-green">Open Scorer</Link>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save Changes'}</button>
        </div>
      </div>

      <div className="page-body flex-col gap-20">

        {/* Teams + Date */}
        <div className="card flex-col gap-16">
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Game Info</div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Away Team</label>
              <select className="form-input" value={form.awayTeam} onChange={e => set('awayTeam', e.target.value)}>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name} ({t.abbreviation})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Home Team</label>
              <select className="form-input" value={form.homeTeam} onChange={e => set('homeTeam', e.target.value)}>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name} ({t.abbreviation})</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date & Time</label>
              <input type="datetime-local" className="form-input" value={toInputDate(form.scheduledDate)} onChange={e => set('scheduledDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Venue</label>
              <input className="form-input" value={form.venue||''} onChange={e => set('venue', e.target.value)} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Round</label>
              <input className="form-input" value={form.round||''} onChange={e => set('round', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Game #</label>
              <input type="number" className="form-input" value={form.gameNumber||''} onChange={e => set('gameNumber', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Live state */}
        <div className="card flex-col gap-16">
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Game State</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                {['scheduled','live','final'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quarter</label>
              <select className="form-input" value={form.currentQuarter} onChange={e => set('currentQuarter', parseInt(e.target.value))}>
                {[1,2,3,4,5].map(q => <option key={q} value={q}>{q===5?'OT':q}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Clock</label>
              <input className="form-input" placeholder="10:00" value={form.gameClock||''} onChange={e => set('gameClock', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Season</label>
              <input className="form-input" value={form.season||''} onChange={e => set('season', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Scores + Fouls */}
        <div className="card flex-col gap-16">
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Scores & Fouls</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            {[['Away', 'away'], ['Home', 'home']].map(([label, side]) => (
              <div key={side}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.8rem', color:'var(--w60)', textTransform:'uppercase', marginBottom:10 }}>
                  {label} — {side==='home' ? game?.homeTeam?.abbreviation : game?.awayTeam?.abbreviation}
                </div>
                <div className="grid-2" style={{ gap:10 }}>
                  <div className="form-group">
                    <label className="form-label">Total Score</label>
                    <input type="number" className="form-input" value={form[`${side}Score`]} onChange={e => set(`${side}Score`, parseInt(e.target.value)||0)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Team Fouls</label>
                    <input type="number" className="form-input" value={form[`${side}TeamFouls`]} onChange={e => set(`${side}TeamFouls`, parseInt(e.target.value)||0)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quarter Scores */}
        <div className="card flex-col gap-16">
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Quarter Scores</div>
          {[['Away','away'],['Home','home']].map(([label, side]) => (
            <div key={side}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'0.72rem', color:'var(--w30)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>{label}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
                {['q1','q2','q3','q4','ot'].map(q => (
                  <div key={q} className="form-group">
                    <label className="form-label">{q.toUpperCase()}</label>
                    <input type="number" className="form-input" style={{ textAlign:'center' }}
                      value={form[`${side}QuarterScores`]?.[q] || 0}
                      onChange={e => setQ(side, q, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="card flex-col gap-12">
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>Notes</div>
          <textarea className="form-input" rows={3} placeholder="Game notes..." value={form.notes||''} onChange={e => set('notes', e.target.value)} style={{ resize:'vertical' }} />
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingBottom:40 }}>
          <Link to="/games" className="btn btn-outline">Cancel</Link>
          <button className="btn btn-gold btn-lg" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save All Changes'}</button>
        </div>
      </div>
    </>
  )
}