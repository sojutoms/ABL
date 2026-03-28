import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import { getGameById, getGameStats, updateGame, bulkUpsertStats } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

// ─── Helpers ─────────────────────────────────────────────
const STAT_KEYS = ['points','fgMade','fgAttempts','threePtMade','threePtAttempts','ftMade','ftAttempts','offRebounds','defRebounds','totalRebounds','assists','steals','blocks','turnovers','personalFouls','plusMinus','minutesPlayed']

const mkBlank = (player, team) => ({
  player: player._id,
  team:   team._id || team,
  isStarter: false, didNotPlay: false,
  points:0, fgMade:0, fgAttempts:0,
  threePtMade:0, threePtAttempts:0,
  ftMade:0, ftAttempts:0,
  offRebounds:0, defRebounds:0, totalRebounds:0,
  assists:0, steals:0, blocks:0,
  turnovers:0, personalFouls:0, plusMinus:0, minutesPlayed:0,
  _playerInfo: player,
})

const StatInput = ({ value, onChange, onIncrement, onDecrement, small }) => (
  <div style={{ display:'flex', alignItems:'center', gap: small?2:4 }}>
    <button onClick={onDecrement}
      style={{ width:small?20:24, height:small?20:24, borderRadius:4, background:'var(--black-5)', border:'1px solid var(--border)', color:'var(--w60)', fontSize:small?'0.7rem':'0.85rem', cursor:'pointer', flexShrink:0 }}>−</button>
    <input
      type="number" min={0} value={value}
      onChange={e => onChange(Math.max(0, parseInt(e.target.value)||0))}
      style={{ width:small?32:38, textAlign:'center', background:'var(--black-4)', border:'1px solid var(--border)', borderRadius:4, color:'var(--white)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:small?'0.78rem':'0.88rem', padding:'2px 0' }}
    />
    <button onClick={onIncrement}
      style={{ width:small?20:24, height:small?20:24, borderRadius:4, background:'var(--gold)', border:'none', color:'var(--black)', fontSize:small?'0.7rem':'0.85rem', fontWeight:800, cursor:'pointer', flexShrink:0 }}>+</button>
  </div>
)

const Avatar = ({ player }) => {
  const initials = `${player?.firstName?.[0]||''}${player?.lastName?.[0]||''}`.toUpperCase()
  if (player?.photo) {
    return <img src={player.photo} alt="" style={{ width:36,height:36,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',flexShrink:0 }} onError={e=>e.target.style.display='none'} />
  }
  return <div style={{ width:36,height:36,borderRadius:'50%',background:'var(--black-5)',border:'2px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontWeight:800,fontSize:'0.72rem',color:'var(--gold)',flexShrink:0 }}>{initials}</div>
}

// ─── Clock component ──────────────────────────────────────
const GameClock = ({ game, onUpdate }) => {
  const [running, setRunning]   = useState(false)
  const [seconds, setSeconds]   = useState(600) // 10 min
  const intervalRef = useRef(null)

  // Parse clock from game
  useEffect(() => {
    if (game?.gameClock) {
      const [m,s] = game.gameClock.split(':').map(Number)
      setSeconds((m||0)*60 + (s||0))
    }
  }, [game?._id])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 0) { setRunning(false); clearInterval(intervalRef.current); return 0 }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const save = () => onUpdate({ gameClock: fmt(seconds) })

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'3rem', letterSpacing:'0.05em', color: running ? 'var(--gold)' : 'var(--white)', lineHeight:1, marginBottom:8 }}>
        {fmt(seconds)}
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:8 }}>
        <button className={`btn btn-sm ${running ? 'btn-red' : 'btn-green'}`} onClick={() => setRunning(r=>!r)}>
          {running ? '⏸ Pause' : '▶ Start'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => { setRunning(false); setSeconds(600) }}>Reset</button>
        <button className="btn btn-outline btn-sm" onClick={save}>💾 Save Clock</button>
      </div>
      <input type="text" className="form-input" placeholder="MM:SS"
        style={{ width:90, textAlign:'center', fontSize:'0.88rem', fontFamily:'var(--font-display)' }}
        defaultValue={fmt(seconds)}
        onBlur={e => {
          const [m,s] = e.target.value.split(':').map(Number)
          if (!isNaN(m) && !isNaN(s)) { setSeconds(m*60+s); onUpdate({ gameClock: e.target.value }) }
        }}
      />
    </div>
  )
}

// ─── Main LiveScorer ──────────────────────────────────────
export default function LiveScorer() {
  const { gameId } = useParams()
  const { addToast } = useToast()

  const [game, setGame]         = useState(null)
  const [homePlayers, setHomePlayers] = useState([])
  const [awayPlayers, setAwayPlayers] = useState([])
  const [homeStats, setHomeStats] = useState({})  // { playerId: statObj }
  const [awayStats, setAwayStats] = useState({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [activeTeam, setActiveTeam] = useState('home')
  const socketRef = useRef(null)

  // Load game + players + existing stats
  const load = useCallback(async () => {
    try {
      const [gRes, sRes] = await Promise.all([
        getGameById(gameId),
        getGameStats(gameId),
      ])
      const g = gRes.data.data
      setGame(g)

      // Get players for both teams
      const { getPlayers } = await import('../services/api.js')
      const [hRes, aRes] = await Promise.all([
        getPlayers(g.homeTeam?._id || g.homeTeam),
        getPlayers(g.awayTeam?._id || g.awayTeam),
      ])
      const hPlayers = hRes.data.data
      const aPlayers = aRes.data.data
      setHomePlayers(hPlayers)
      setAwayPlayers(aPlayers)

      // Build stats maps
      const existing = sRes.data.data
      const hMap = {}, aMap = {}

      hPlayers.forEach(p => {
        const found = existing.find(s => (s.player?._id||s.player) === p._id)
        hMap[p._id] = found ? { ...found, _playerInfo: p } : mkBlank(p, g.homeTeam)
      })
      aPlayers.forEach(p => {
        const found = existing.find(s => (s.player?._id||s.player) === p._id)
        aMap[p._id] = found ? { ...found, _playerInfo: p } : mkBlank(p, g.awayTeam)
      })

      setHomeStats(hMap)
      setAwayStats(aMap)
    } catch (e) {
      addToast('Failed to load game data', 'error')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => { load() }, [load])

  // Socket
  useEffect(() => {
    const socket = io('http://localhost:5000', { transports: ['websocket'] })
    socketRef.current = socket
    return () => socket.disconnect()
  }, [])

  // Update a single stat for a player
  const updateStat = (team, playerId, key, val) => {
    const setter = team === 'home' ? setHomeStats : setAwayStats
    setter(prev => {
      const updated = { ...prev[playerId], [key]: val }
      // Auto-calc totalRebounds
      if (key === 'offRebounds' || key === 'defRebounds') {
        updated.totalRebounds = (updated.offRebounds||0) + (updated.defRebounds||0)
      }
      // Auto-calc points from FG + 3P + FT
      if (['fgMade','threePtMade','ftMade'].includes(key)) {
        const fg  = key==='fgMade'      ? val : (updated.fgMade||0)
        const tp  = key==='threePtMade' ? val : (updated.threePtMade||0)
        const ft  = key==='ftMade'      ? val : (updated.ftMade||0)
        updated.points = (fg * 2) - (tp * 2) + (tp * 3) + ft  // 2pt = fg-3p, 3pt, ft
        // Simpler: fg includes 3pt so: pts = (fg-tp)*2 + tp*3 + ft
        updated.points = ((fg - tp) * 2) + (tp * 3) + ft
      }
      return { ...prev, [playerId]: updated }
    })
  }

  const inc = (team, pid, key) => {
    const stats = team === 'home' ? homeStats : awayStats
    updateStat(team, pid, key, (stats[pid]?.[key]||0) + 1)
  }
  const dec = (team, pid, key) => {
    const stats = team === 'home' ? homeStats : awayStats
    updateStat(team, pid, key, Math.max(0, (stats[pid]?.[key]||0) - 1))
  }

  // Save all stats + emit socket
  const saveStats = async () => {
    setSaving(true)
    try {
      const allStats = [
        ...Object.values(homeStats).filter(s => !s.didNotPlay),
        ...Object.values(awayStats).filter(s => !s.didNotPlay),
      ].map(({ _playerInfo, _id, __v, createdAt, updatedAt, ...rest }) => rest)

      await bulkUpsertStats(gameId, allStats)
      socketRef.current?.emit('joinGame', gameId)
      addToast('Stats saved!', 'success')
    } catch (e) {
      addToast('Failed to save stats', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Update game fields (score, quarter, fouls, status, clock)
  const updateGameField = async (fields) => {
    try {
      const res = await updateGame(gameId, fields)
      setGame(res.data.data)
      addToast('Game updated', 'success')
    } catch {
      addToast('Failed to update game', 'error')
    }
  }

  if (loading) return (
    <div style={{ padding: 40 }}>
      <div className="skeleton" style={{ height: 200, borderRadius: 16, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
    </div>
  )

  if (!game) return <div style={{ padding: 40, color: 'var(--red)' }}>Game not found. <Link to="/games" style={{ color:'var(--gold)' }}>Back</Link></div>

  const isLive  = game.status === 'live'
  const stats   = activeTeam === 'home' ? homeStats : awayStats
  const players = activeTeam === 'home' ? homePlayers : awayPlayers
  const team    = activeTeam === 'home' ? game.homeTeam : game.awayTeam
  const qLabel  = ['1ST','2ND','3RD','4TH','OT'][game.currentQuarter-1] || `Q${game.currentQuarter}`

  return (
    <>
      <div className="page-header" style={{ gap: 12 }}>
        <div>
          <Link to="/games" style={{ color:'var(--w30)', fontSize:'0.78rem', fontFamily:'var(--font-display)', textTransform:'uppercase', letterSpacing:'0.08em' }}>← Games</Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {game.awayTeam?.abbreviation} <span style={{ color:'var(--w30)', fontWeight:400 }}>@</span> {game.homeTeam?.abbreviation}
            {isLive && <span className="badge badge-live" style={{ marginLeft:12 }}><span className="live-dot"/>LIVE</span>}
          </h1>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline" onClick={load}>↺ Refresh</button>
          <button className="btn btn-gold" onClick={saveStats} disabled={saving}>{saving ? 'Saving…' : '💾 Save Stats'}</button>
        </div>
      </div>

      <div className="page-body">
        {/* ─── Scoreboard Control ─────────────────────────── */}
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:20, alignItems:'center' }}>

            {/* Away team score */}
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--w30)', marginBottom:4 }}>
                AWAY · {game.awayTeam?.abbreviation}
              </div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'3.5rem', color:'var(--white)', lineHeight:1 }}>{game.awayScore}</div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => updateGameField({ awayScore: Math.max(0, game.awayScore-1) })}>−1</button>
                <button className="btn btn-gold btn-sm" onClick={() => updateGameField({ awayScore: game.awayScore+1 })}>+1</button>
                <button className="btn btn-gold btn-sm" onClick={() => updateGameField({ awayScore: game.awayScore+2 })}>+2</button>
                <button className="btn btn-gold btn-sm" onClick={() => updateGameField({ awayScore: game.awayScore+3 })}>+3</button>
              </div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:'0.7rem', color:'var(--w30)', fontFamily:'var(--font-display)', textTransform:'uppercase', marginBottom:4 }}>Team Fouls</div>
                <div style={{ display:'flex', gap:6, justifyContent:'center', alignItems:'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => updateGameField({ awayTeamFouls: Math.max(0, game.awayTeamFouls-1) })}>−</button>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', minWidth:28, textAlign:'center', color: game.awayTeamFouls >= 5 ? 'var(--red)' : 'var(--white)' }}>{game.awayTeamFouls}</span>
                  <button className="btn btn-gold btn-sm" onClick={() => updateGameField({ awayTeamFouls: game.awayTeamFouls+1 })}>+</button>
                </div>
              </div>
            </div>

            {/* Center: Clock + Quarter + Status */}
            <div style={{ textAlign:'center', minWidth:200 }}>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.1rem', color:'var(--gold)', letterSpacing:'0.1em', marginBottom:4 }}>
                  {qLabel} QUARTER
                </div>
                <GameClock game={game} onUpdate={updateGameField} />
              </div>

              {/* Quarter controls */}
              <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:12 }}>
                {[1,2,3,4,5].map(q => (
                  <button key={q} onClick={() => updateGameField({ currentQuarter: q })}
                    className={`btn btn-sm ${game.currentQuarter===q ? 'btn-gold' : 'btn-outline'}`}
                    style={{ padding:'4px 8px' }}>
                    {q===5?'OT':q}
                  </button>
                ))}
              </div>

              {/* Game status */}
              <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                {['scheduled','live','final'].map(s => (
                  <button key={s} onClick={() => updateGameField({ status: s })}
                    className={`btn btn-sm ${game.status===s ? (s==='live'?'btn-red':s==='final'?'btn-outline':'btn-green') : 'btn-outline'}`}
                    style={{ textTransform:'capitalize' }}>
                    {s==='live' && <span className="live-dot" style={{ marginRight:4 }}/>}
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Home team score */}
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--w30)', marginBottom:4 }}>
                HOME · {game.homeTeam?.abbreviation}
              </div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'3.5rem', color:'var(--white)', lineHeight:1 }}>{game.homeScore}</div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => updateGameField({ homeScore: Math.max(0, game.homeScore-1) })}>−1</button>
                <button className="btn btn-gold btn-sm" onClick={() => updateGameField({ homeScore: game.homeScore+1 })}>+1</button>
                <button className="btn btn-gold btn-sm" onClick={() => updateGameField({ homeScore: game.homeScore+2 })}>+2</button>
                <button className="btn btn-gold btn-sm" onClick={() => updateGameField({ homeScore: game.homeScore+3 })}>+3</button>
              </div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:'0.7rem', color:'var(--w30)', fontFamily:'var(--font-display)', textTransform:'uppercase', marginBottom:4 }}>Team Fouls</div>
                <div style={{ display:'flex', gap:6, justifyContent:'center', alignItems:'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => updateGameField({ homeTeamFouls: Math.max(0, game.homeTeamFouls-1) })}>−</button>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', minWidth:28, textAlign:'center', color: game.homeTeamFouls >= 5 ? 'var(--red)' : 'var(--white)' }}>{game.homeTeamFouls}</span>
                  <button className="btn btn-gold btn-sm" onClick={() => updateGameField({ homeTeamFouls: game.homeTeamFouls+1 })}>+</button>
                </div>
              </div>
            </div>
          </div>

          {/* Quarter scores row */}
          <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--w30)', marginBottom:8 }}>Quarter Scores</div>
            <div style={{ display:'grid', gridTemplateColumns:'80px repeat(5,1fr)', gap:8, alignItems:'center' }}>
              {[
                { label: game.awayTeam?.abbreviation, scores: game.awayQuarterScores, key: 'away' },
                { label: game.homeTeam?.abbreviation, scores: game.homeQuarterScores, key: 'home' },
              ].map(row => (
                <React.Fragment key={row.key}>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.8rem', color:'var(--w60)' }}>{row.label}</div>
                  {['q1','q2','q3','q4','ot'].map(q => (
                    <div key={q} style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:'var(--font-display)', fontSize:'0.6rem', color:'var(--w30)', textTransform:'uppercase', marginBottom:2 }}>{q.toUpperCase()}</div>
                      <input type="number" min={0} value={row.scores?.[q]||0}
                        onChange={e => {
                          const val = parseInt(e.target.value)||0
                          const field = row.key==='away' ? 'awayQuarterScores' : 'homeQuarterScores'
                          updateGameField({ [field]: { ...row.scores, [q]: val } })
                        }}
                        style={{ width:'100%', textAlign:'center', background:'var(--black-4)', border:'1px solid var(--border)', borderRadius:4, color:'var(--white)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.88rem', padding:'4px 2px' }}
                      />
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Box Score Input ────────────────────────────── */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {/* Team tab switcher */}
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
            {[
              { key:'away', team: game.awayTeam },
              { key:'home', team: game.homeTeam },
            ].map(({ key, team:t }) => (
              <button key={key} onClick={() => setActiveTeam(key)}
                style={{
                  flex:1, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.9rem', textTransform:'uppercase', letterSpacing:'0.06em',
                  color: activeTeam===key ? 'var(--gold)' : 'var(--w60)',
                  borderBottom: activeTeam===key ? '2px solid var(--gold)' : '2px solid transparent',
                  background: activeTeam===key ? 'var(--gold-glow)' : 'transparent',
                  cursor:'pointer', border:'none', transition:'all 0.18s ease',
                }}>
                {t?.abbreviation} — {key==='home'?'Home':'Away'}
              </button>
            ))}
          </div>

          <div style={{ overflowX:'auto' }}>
            <table className="tbl" style={{ minWidth:1100 }}>
              <thead>
                <tr>
                  <th style={{ minWidth:160 }}>Player</th>
                  <th style={{ textAlign:'center' }}>Starter</th>
                  <th style={{ textAlign:'center' }}>DNP</th>
                  <th style={{ textAlign:'center' }}>MIN</th>
                  <th style={{ textAlign:'center', color:'var(--gold)' }}>PTS</th>
                  <th style={{ textAlign:'center' }}>FGM</th>
                  <th style={{ textAlign:'center' }}>FGA</th>
                  <th style={{ textAlign:'center' }}>3PM</th>
                  <th style={{ textAlign:'center' }}>3PA</th>
                  <th style={{ textAlign:'center' }}>FTM</th>
                  <th style={{ textAlign:'center' }}>FTA</th>
                  <th style={{ textAlign:'center' }}>OR</th>
                  <th style={{ textAlign:'center' }}>DR</th>
                  <th style={{ textAlign:'center' }}>REB</th>
                  <th style={{ textAlign:'center' }}>AST</th>
                  <th style={{ textAlign:'center' }}>STL</th>
                  <th style={{ textAlign:'center' }}>BLK</th>
                  <th style={{ textAlign:'center' }}>TO</th>
                  <th style={{ textAlign:'center' }}>PF</th>
                  <th style={{ textAlign:'center' }}>+/−</th>
                </tr>
              </thead>
              <tbody>
                {players.sort((a,b) => a.jerseyNumber - b.jerseyNumber).map(player => {
                  const s = stats[player._id] || mkBlank(player, team)
                  const sid = player._id

                  return (
                    <tr key={sid} style={{ opacity: s.didNotPlay ? 0.45 : 1, background: s.isStarter ? 'rgba(245,197,24,0.03)' : 'transparent' }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <Avatar player={{ ...player, photo: player.photo }} />
                          <div>
                            <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{player.firstName} {player.lastName}</div>
                            <div style={{ fontFamily:'var(--font-display)', fontSize:'0.65rem', color:'var(--gold)' }}>#{player.jerseyNumber} · {player.position}</div>
                          </div>
                        </div>
                      </td>

                      {/* Starter toggle */}
                      <td style={{ textAlign:'center' }}>
                        <button onClick={() => updateStat(activeTeam, sid, 'isStarter', !s.isStarter)}
                          style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${s.isStarter?'var(--gold)':'var(--border)'}`, background: s.isStarter?'var(--gold)':'transparent', cursor:'pointer' }}>
                          {s.isStarter && <span style={{ color:'var(--black)', fontWeight:800, fontSize:'0.65rem' }}>★</span>}
                        </button>
                      </td>

                      {/* DNP toggle */}
                      <td style={{ textAlign:'center' }}>
                        <button onClick={() => updateStat(activeTeam, sid, 'didNotPlay', !s.didNotPlay)}
                          style={{ width:24, height:24, borderRadius:4, border:`2px solid ${s.didNotPlay?'var(--red)':'var(--border)'}`, background: s.didNotPlay?'var(--red-glow)':'transparent', cursor:'pointer', color: s.didNotPlay?'var(--red)':'var(--w30)', fontSize:'0.65rem', fontWeight:800 }}>
                          {s.didNotPlay ? '✕' : ''}
                        </button>
                      </td>

                      {/* Stat inputs */}
                      {[
                        ['minutesPlayed'],
                        ['points'],
                        ['fgMade'], ['fgAttempts'],
                        ['threePtMade'], ['threePtAttempts'],
                        ['ftMade'], ['ftAttempts'],
                        ['offRebounds'], ['defRebounds'], ['totalRebounds'],
                        ['assists'], ['steals'], ['blocks'],
                        ['turnovers'], ['personalFouls'],
                      ].map(([key]) => (
                        <td key={key} style={{ textAlign:'center', padding:'6px 4px' }}>
                          <StatInput
                            small
                            value={s[key]||0}
                            onChange={v => updateStat(activeTeam, sid, key, v)}
                            onIncrement={() => inc(activeTeam, sid, key)}
                            onDecrement={() => dec(activeTeam, sid, key)}
                          />
                        </td>
                      ))}

                      {/* Plus/minus (can be negative) */}
                      <td style={{ textAlign:'center', padding:'6px 4px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:2, justifyContent:'center' }}>
                          <button onClick={() => updateStat(activeTeam, sid, 'plusMinus', (s.plusMinus||0)-1)}
                            style={{ width:20, height:20, borderRadius:4, background:'var(--black-5)', border:'1px solid var(--border)', color:'var(--red)', fontSize:'0.7rem', cursor:'pointer' }}>−</button>
                          <input type="number" value={s.plusMinus||0}
                            onChange={e => updateStat(activeTeam, sid, 'plusMinus', parseInt(e.target.value)||0)}
                            style={{ width:38, textAlign:'center', background:'var(--black-4)', border:'1px solid var(--border)', borderRadius:4, color: (s.plusMinus||0)>0?'var(--green)':(s.plusMinus||0)<0?'var(--red)':'var(--white)', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.78rem', padding:'2px 0' }}
                          />
                          <button onClick={() => updateStat(activeTeam, sid, 'plusMinus', (s.plusMinus||0)+1)}
                            style={{ width:20, height:20, borderRadius:4, background:'var(--green-glow)', border:'1px solid var(--green)', color:'var(--green)', fontSize:'0.7rem', fontWeight:800, cursor:'pointer' }}>+</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button className="btn btn-outline" onClick={load}>↺ Reset</button>
            <button className="btn btn-gold btn-lg" onClick={saveStats} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save All Stats'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}