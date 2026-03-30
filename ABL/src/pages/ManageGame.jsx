import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getGameById, updateGame, getTeams } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

export default function ManageGame() {
  const { gameId } = useParams()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [game, setGame]     = useState(null)
  const [teams, setTeams]   = useState([])
  const [form, setForm]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [isFinal, setIsFinal] = useState(false)

  useEffect(() => {
    Promise.all([getGameById(gameId), getTeams()]).then(([g, t]) => {
      const gd = g.data.data
      setGame(gd)
      setTeams(t.data.data)
      if (gd.status === 'final') {
        setIsFinal(true)
        addToast('This game is FINAL — view only.', 'info')
      }
      setForm({
        homeTeam: gd.homeTeam?._id || gd.homeTeam,
        awayTeam: gd.awayTeam?._id || gd.awayTeam,
        homeScore: gd.homeScore, awayScore: gd.awayScore,
        homeTeamFouls: gd.homeTeamFouls, awayTeamFouls: gd.awayTeamFouls,
        status: gd.status, currentQuarter: gd.currentQuarter,
        gameClock: gd.gameClock, isOvertime: gd.isOvertime,
        homeQuarterScores: gd.homeQuarterScores || { q1:0,q2:0,q3:0,q4:0,ot:0 },
        awayQuarterScores: gd.awayQuarterScores || { q1:0,q2:0,q3:0,q4:0,ot:0 },
        scheduledDate: gd.scheduledDate, venue: gd.venue,
        round: gd.round, season: gd.season, gameNumber: gd.gameNumber,
        broadcastChannel: gd.broadcastChannel, notes: gd.notes,
      })
    })
  }, [gameId])

  const set = (k, v) => { if (isFinal) return; setForm(f => ({ ...f, [k]: v })) }
  const setQ = (team, q, v) => {
    if (isFinal) return
    setForm(f => ({
      ...f,
      [`${team}QuarterScores`]: { ...f[`${team}QuarterScores`], [q]: parseInt(v) || 0 },
    }))
  }

  const handleSave = async () => {
    if (isFinal) { addToast('Cannot edit a finalized game.', 'error'); return }
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
  const inputStyle = { opacity: isFinal ? 0.6 : 1, pointerEvents: isFinal ? 'none' : 'auto' }

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/games" style={{ color:'var(--w30)', fontSize:'0.78rem', fontFamily:'var(--font-display)', textTransform:'uppercase', letterSpacing:'0.08em' }}>← Games</Link>
          <h1 className="page-title" style={{ marginTop:4 }}>
            {game?.awayTeam?.abbreviation} @ {game?.homeTeam?.abbreviation} — {isFinal ? 'View (Final)' : 'Edit'}
          </h1>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {isFinal
            ? <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:8, background:'rgba(46,194,126,0.1)', border:'1px solid var(--green)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.8rem', color:'var(--green)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                ✓ FINAL — Read Only
              </div>
            : <>
                <Link to={`/games/${gameId}/score`} className="btn btn-green">Open Scorer</Link>
                <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save Changes'}</button>
              </>
          }
        </div>
      </div>

      {/* Final game banner */}
      {isFinal && (
        <div style={{ margin:'0 32px 0', padding:'12px 20px', background:'rgba(46,194,126,0.08)', border:'1px solid var(--green)', borderRadius:10, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:'1.2rem' }}>🏆</span>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.9rem', color:'var(--green)', textTransform:'uppercase' }}>Game Finalized</div>
            <div style={{ fontSize:'0.78rem', color:'var(--w60)' }}>This game's stats and scores are locked. No further editing is allowed.</div>
          </div>
        </div>
      )}

      <div className="page-body flex-col gap-20">
        {/* Final scoreboard display */}
        {isFinal && (
          <div className="card" style={{ textAlign:'center', padding:'28px 20px' }}>
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:32 }}>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', color:'var(--w30)', textTransform:'uppercase', marginBottom:4 }}>AWAY · {game?.awayTeam?.abbreviation}</div>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'3.5rem', color: form.awayScore > form.homeScore ? 'var(--gold)' : 'var(--white)' }}>{form.awayScore}</div>
              </div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.2rem', color:'var(--w30)' }}>FINAL</div>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', color:'var(--w30)', textTransform:'uppercase', marginBottom:4 }}>HOME · {game?.homeTeam?.abbreviation}</div>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'3.5rem', color: form.homeScore > form.awayScore ? 'var(--gold)' : 'var(--white)' }}>{form.homeScore}</div>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:12, marginTop:12 }}>
              {['q1','q2','q3','q4','ot'].map(q => (
                <div key={q} style={{ textAlign:'center', minWidth:36 }}>
                  <div style={{ fontSize:'0.6rem', color:'var(--w30)', fontFamily:'var(--font-display)', textTransform:'uppercase', marginBottom:2 }}>{q.toUpperCase()}</div>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.88rem', color:'var(--w60)' }}>{form.awayQuarterScores?.[q]||0} – {form.homeQuarterScores?.[q]||0}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game Info */}
        <div className="card flex-col gap-16" style={inputStyle}>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Game Info</div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Away Team</label>
              <select className="form-input" value={form.awayTeam} onChange={e => set('awayTeam', e.target.value)} disabled={isFinal}>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name} ({t.abbreviation})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Home Team</label>
              <select className="form-input" value={form.homeTeam} onChange={e => set('homeTeam', e.target.value)} disabled={isFinal}>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name} ({t.abbreviation})</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date & Time</label>
              <input type="datetime-local" className="form-input" value={toInputDate(form.scheduledDate)} onChange={e => set('scheduledDate', e.target.value)} disabled={isFinal} />
            </div>
            <div className="form-group">
              <label className="form-label">Venue</label>
              <input className="form-input" value={form.venue||''} onChange={e => set('venue', e.target.value)} disabled={isFinal} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Round</label>
              <input className="form-input" value={form.round||''} onChange={e => set('round', e.target.value)} disabled={isFinal} />
            </div>
            <div className="form-group">
              <label className="form-label">Game #</label>
              <input type="number" className="form-input" value={form.gameNumber||''} onChange={e => set('gameNumber', e.target.value)} disabled={isFinal} />
            </div>
          </div>
        </div>

        {/* Quarter Scores - always visible */}
        <div className="card flex-col gap-16">
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Quarter Scores</div>
          {[['Away','away'],['Home','home']].map(([label, side]) => (
            <div key={side}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'0.72rem', color:'var(--w30)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>{label}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
                {['q1','q2','q3','q4','ot'].map(q => (
                  <div key={q} className="form-group">
                    <label className="form-label">{q.toUpperCase()}</label>
                    <input type="number" className="form-input" style={{ textAlign:'center', ...inputStyle }}
                      value={form[`${side}QuarterScores`]?.[q] || 0}
                      onChange={e => setQ(side, q, e.target.value)}
                      disabled={isFinal}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Game State - only for non-final */}
        {!isFinal && (
          <div className="card flex-col gap-16">
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Game State</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {['scheduled','live'].map(s => <option key={s} value={s}>{s}</option>)}
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
        )}

        {/* Notes */}
        <div className="card flex-col gap-12">
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.95rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>Notes</div>
          <textarea className="form-input" rows={3} placeholder="Game notes..." value={form.notes||''} onChange={e => set('notes', e.target.value)} style={{ resize:'vertical', ...inputStyle }} disabled={isFinal} />
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingBottom:40 }}>
          <Link to="/games" className="btn btn-outline">Back to Games</Link>
          {!isFinal && (
            <button className="btn btn-gold btn-lg" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save Changes'}</button>
          )}
        </div>
      </div>
    </>
  )
}