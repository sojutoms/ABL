import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  getGameById, getGameStats, updateGame,
  bulkUpsertStats, getPlayers,
} from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'
import './LiveScorer.css'

// ─── Constants ────────────────────────────────────────────
const QUARTER_DURATION = 600
const SAVE_DEBOUNCE    = 350
const STORAGE_KEY      = (gid) => `abl_oncourt_${gid}`

// ─── Pure helpers ─────────────────────────────────────────
const fmtClock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const parseClock = (str) => {
  const [m, s] = (str || '10:00').split(':').map(Number)
  return ((m || 0) * 60) + (s || 0)
}

const QKEY   = (q) => (q <= 4 ? `q${q}` : 'ot')
const sumQS  = (qs) => Object.values(qs || {}).reduce((a, b) => a + b, 0)
const calcPts = (s) =>
  Math.max(0, (s.fgMade||0) - (s.threePtMade||0)) * 2 +
  (s.threePtMade||0) * 3 +
  (s.ftMade||0)

const sumMapPts = (map) =>
  Object.values(map).reduce((a, s) => a + (s.points || 0), 0)

// Strip internal fields before API save
const toApi = ({ _playerInfo, onCourt, _secondsPlayed, _id, __v, createdAt, updatedAt, ...r }) => r

const mkBlank = (player, teamId, onCourt = false) => ({
  player: player._id, team: teamId,
  isStarter: onCourt, didNotPlay: false, onCourt,
  points: 0, fgMade: 0, fgAttempts: 0,
  threePtMade: 0, threePtAttempts: 0, ftMade: 0, ftAttempts: 0,
  offRebounds: 0, defRebounds: 0, totalRebounds: 0,
  assists: 0, steals: 0, blocks: 0,
  turnovers: 0, personalFouls: 0, plusMinus: 0,
  minutesPlayed: 0, _secondsPlayed: 0, _playerInfo: player,
})

// ─────────────────────────────────────────────────────────
// +/- DESIGN
// ─────────────────────────────────────────────────────────
// pmEntry is stored as a REF (per component instance, not a
// module-level singleton).  This means:
//   • Each scorer tab has its own independent entry table
//   • It survives re-renders without getting reset
//   • It's initialised fresh on every load() call
//
// Formula: +/- = (myTeamPts - entryMyTeam) - (oppPts - entryOpp)
// It is computed INLINE inside the state setter so no async
// gap exists between "score changes" and "+/- updates".
// ─────────────────────────────────────────────────────────

// Recalculate +/- for every on-court player in a map
// given current total scores.  Returns same ref if nothing changed.
const recalcPM = (map, side, hPts, aPts, pmEntryMap) => {
  let changed = false
  const next = { ...map }
  Object.keys(next).forEach(pid => {
    if (!next[pid].onCourt || next[pid].didNotPlay) return
    const e = pmEntryMap.get(pid)
    if (!e) return
    const pm = side === 'home'
      ? (hPts - e.homeScore) - (aPts - e.awayScore)
      : (aPts - e.awayScore) - (hPts - e.homeScore)
    if (pm !== next[pid].plusMinus) {
      next[pid] = { ...next[pid], plusMinus: pm }
      changed = true
    }
  })
  return changed ? next : map
}

// ─── Stat column definitions ──────────────────────────────
const COLS = [
  { key:'points',          label:'PTS', ro:true              },
  { key:'fgMade',          label:'FGM', makes:true           },
  { key:'fgAttempts',      label:'FGA'                       },
  { key:'threePtMade',     label:'3PM', makes:true           },
  { key:'threePtAttempts', label:'3PA'                       },
  { key:'ftMade',          label:'FTM', makes:true           },
  { key:'ftAttempts',      label:'FTA'                       },
  { key:'offRebounds',     label:'OR'                        },
  { key:'defRebounds',     label:'DR'                        },
  { key:'totalRebounds',   label:'REB', ro:true              },
  { key:'assists',         label:'AST'                       },
  { key:'steals',          label:'STL'                       },
  { key:'blocks',          label:'BLK'                       },
  { key:'turnovers',       label:'TO'                        },
  { key:'personalFouls',   label:'PF',  pf:true              },
  { key:'plusMinus',       label:'+/−', ro:true, pm:true     },
  { key:'minutesPlayed',   label:'MIN', ro:true              },
]

// ─── Confirm modal ────────────────────────────────────────
const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="confirm-overlay">
    <div className="confirm-box">
      <div className="confirm-box__icon">🏆</div>
      <div className="confirm-box__title">{title}</div>
      <p className="confirm-box__msg">{message}</p>
      <div className="confirm-box__actions">
        <button onClick={onCancel}  className="btn btn-outline">Cancel</button>
        <button onClick={onConfirm} className="btn btn-green btn-lg">Yes, Finalize</button>
      </div>
    </div>
  </div>
)

// ─── Stat cell (pure) ─────────────────────────────────────
function StatCell({ col, s, sp, isOn, side, pid, onInc, onDec }) {
  if (col.key === 'points')        return <td><span className="cell-pts">{s.points||0}</span></td>
  if (col.key === 'totalRebounds') return <td><span className="cell-reb">{s.totalRebounds||0}</span></td>
  if (col.key === 'minutesPlayed') return (
    <td><span className={`cell-min${isOn?' cell-min--oncourt':''}`}>
      {Math.floor(sp/60)}:{String(Math.round(sp%60)).padStart(2,'0')}
    </span></td>
  )
  if (col.key === 'plusMinus') {
    const val = s.plusMinus || 0
    const cls = val > 0 ? 'cell-pm cell-pm--pos' : val < 0 ? 'cell-pm cell-pm--neg' : 'cell-pm cell-pm--zero'
    return <td><span className={cls}>{val > 0 ? `+${val}` : val}</span></td>
  }

  const val  = s[col.key] ?? 0
  let vCls   = 'stat-cell__val'
  if (col.pf && val >= 5) vCls += ' stat-cell__val--red'
  let iCls = 'stat-cell__inc'
  if (col.pf)    iCls += ' stat-cell__inc--pf'
  else if (col.makes) iCls += ' stat-cell__inc--makes'

  return (
    <td>
      <div className="stat-cell">
        <button className="stat-cell__dec" onClick={() => isOn && onDec(side, pid, col.key)}>−</button>
        <span className={vCls}>{val}</span>
        <button className={iCls}  onClick={() => isOn && onInc(side, pid, col.key)}>+</button>
      </div>
    </td>
  )
}

// ─── Player row ───────────────────────────────────────────
function PlayerRow({ player, s, isOn, side, onInc, onDec }) {
  const sp = s._secondsPlayed || 0
  return (
    <tr className={isOn ? 'row--on-court' : 'row--bench'}>
      <td>
        <div className="player-cell">
          <div className="player-num-circle" style={{ width:30, height:30, fontSize:'0.85rem' }}>
            {player.jerseyNumber}
          </div>
          <div className="player-cell__info">
            <span className="player-cell__name">{player.firstName} {player.lastName}</span>
            <span className="player-cell__badge">{player.position}</span>
          </div>
          {isOn && <span className="player-cell__dot"/>}
        </div>
      </td>
      {COLS.map(col => (
        <StatCell key={col.key} col={col} s={s} sp={sp} isOn={isOn}
          side={side} pid={player._id} onInc={onInc} onDec={onDec}
        />
      ))}
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────
export default function LiveScorer() {
  const { gameId }   = useParams()
  const { addToast } = useToast()
  const navigate     = useNavigate()

  const [game,        setGame]        = useState(null)
  const [homeStats,   setHomeStats]   = useState({})
  const [awayStats,   setAwayStats]   = useState({})
  const [homePlayers, setHomePlayers] = useState([])
  const [awayPlayers, setAwayPlayers] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTeam,  setActiveTeam]  = useState('home')
  const [showConfirm, setShowConfirm] = useState(false)

  const [clockSecs, setClockSecs] = useState(QUARTER_DURATION)
  const [running,   setRunning]   = useState(false)
  const [curQ,      setCurQ]      = useState(1)
  const [homeQS,    setHomeQS]    = useState({ q1:0,q2:0,q3:0,q4:0,ot:0 })
  const [awayQS,    setAwayQS]    = useState({ q1:0,q2:0,q3:0,q4:0,ot:0 })
  const [teamFouls, setTeamFouls] = useState({
    home:{1:0,2:0,3:0,4:0,5:0}, away:{1:0,2:0,3:0,4:0,5:0}
  })
  const [dragPid,  setDragPid]  = useState(null)
  const [dragSide, setDragSide] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  // ── Mutable refs (always synchronous) ─────────────────
  const socketRef     = useRef(null)
  const saveTimer     = useRef(null)
  const clockInterval = useRef(null)
  const homeStatsRef  = useRef({})
  const awayStatsRef  = useRef({})
  const homeQSRef     = useRef({ q1:0,q2:0,q3:0,q4:0,ot:0 })
  const awayQSRef     = useRef({ q1:0,q2:0,q3:0,q4:0,ot:0 })
  const clockSecRef   = useRef(QUARTER_DURATION)
  const curQRef       = useRef(1)
  const tfRef         = useRef({ home:{1:0,2:0,3:0,4:0,5:0}, away:{1:0,2:0,3:0,4:0,5:0} })

  // ── PER-INSTANCE pmEntry map (NOT a module-level singleton) ──
  // This stores { pid → { homeScore, awayScore } } at the moment
  // each player stepped on court.  Stored as a ref so it persists
  // across renders without causing re-renders.
  const pmEntryRef = useRef(new Map())

  // ── Socket setup ──────────────────────────────────────
  useEffect(() => {
    const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
    const socket = io(URL, { transports: ['websocket'] })
    socketRef.current = socket
    socket.emit('joinGame', gameId)

    // ── Another scorer updated game state (clock/score/fouls) ──
    socket.on('gameUpdate', ({ game: g }) => {
      if (!g) return
      setGame(g)
      const q = g.currentQuarter || 1
      setCurQ(q); curQRef.current = q

      const hq = g.homeQuarterScores || { q1:0,q2:0,q3:0,q4:0,ot:0 }
      const aq = g.awayQuarterScores || { q1:0,q2:0,q3:0,q4:0,ot:0 }
      homeQSRef.current = hq; awayQSRef.current = aq
      setHomeQS(hq); setAwayQS(aq)

      if (g.homeTeamFouls !== undefined || g.awayTeamFouls !== undefined) {
        setTeamFouls(prev => {
          const next = {
            home: { ...prev.home, [q]: g.homeTeamFouls ?? prev.home[q] },
            away: { ...prev.away, [q]: g.awayTeamFouls ?? prev.away[q] },
          }
          tfRef.current = next
          return next
        })
      }

      // After QS update from another scorer, recompute our +/- too
      const hPts = sumQS(hq)
      const aPts = sumQS(aq)
      setHomeStats(prev => {
        const n = recalcPM(prev, 'home', hPts, aPts, pmEntryRef.current)
        homeStatsRef.current = n; return n
      })
      setAwayStats(prev => {
        const n = recalcPM(prev, 'away', hPts, aPts, pmEntryRef.current)
        awayStatsRef.current = n; return n
      })
    })

    // ── Another scorer updated a player's stats (box score) ──
    // Key: we merge their STAT VALUES but keep our local computed
    // values for: onCourt, _secondsPlayed, and plusMinus
    // (we recompute plusMinus ourselves from pmEntry — don't trust DB value)
    socket.on('boxScoreUpdate', ({ stats: list }) => {
      if (!Array.isArray(list)) return

      list.forEach(updated => {
        const pid = updated.player?._id || updated.player
        const tid = updated.team?._id   || updated.team

        // Find which map this player belongs to
        const inHome = homeStatsRef.current[pid] !== undefined ||
          Object.values(homeStatsRef.current).some(s => String(s.team) === String(tid))

        const setter    = inHome ? setHomeStats : setAwayStats
        const statsRef  = inHome ? homeStatsRef  : awayStatsRef
        const side      = inHome ? 'home'         : 'away'

        setter(prev => {
          const existing = prev[pid]
          if (!existing) return prev   // not on our roster

          // Merge: take their stats, keep our local tracking fields
          const merged = {
            ...updated,
            onCourt:        existing.onCourt,
            _secondsPlayed: existing._secondsPlayed,
            _playerInfo:    existing._playerInfo,
            // Recompute +/- from our own pmEntry (not from DB)
            plusMinus: (() => {
              const e = pmEntryRef.current.get(pid)
              if (!e || !existing.onCourt) return existing.plusMinus
              const hPts = sumQS(homeQSRef.current)
              const aPts = sumQS(awayQSRef.current)
              return side === 'home'
                ? (hPts - e.homeScore) - (aPts - e.awayScore)
                : (aPts - e.awayScore) - (hPts - e.homeScore)
            })(),
          }

          const newMap = { ...prev, [pid]: merged }
          statsRef.current = newMap
          return newMap
        })
      })
    })

    // ── Viewer-side scoreboard push (sync QS only) ──
    socket.on('scoreboardUpdate', ({ game: g }) => {
      if (!g || g.status === 'final') return
      if (g.homeQuarterScores) {
        homeQSRef.current = g.homeQuarterScores
        setHomeQS(g.homeQuarterScores)
      }
      if (g.awayQuarterScores) {
        awayQSRef.current = g.awayQuarterScores
        setAwayQS(g.awayQuarterScores)
      }
    })

    return () => { socket.emit('leaveGame', gameId); socket.disconnect() }
  }, [gameId])

  // ── Debounced save + broadcast ─────────────────────────
  const save = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const hq = homeQSRef.current
        const aq = awayQSRef.current
        const q  = curQRef.current
        const tf = tfRef.current

        const gRes = await updateGame(gameId, {
          gameClock:         fmtClock(clockSecRef.current),
          currentQuarter:    q,
          homeScore:         sumQS(hq),
          awayScore:         sumQS(aq),
          homeQuarterScores: hq,
          awayQuarterScores: aq,
          homeTeamFouls:     tf.home[q] || 0,
          awayTeamFouls:     tf.away[q] || 0,
        })
        setGame(gRes.data.data)

        // Broadcast game state to other scorers and viewers
        socketRef.current?.emit('gameUpdate',      { game: gRes.data.data })
        socketRef.current?.emit('scoreboardUpdate', { game: gRes.data.data })

        // Save all stats
        const allStats = [
          ...Object.values(homeStatsRef.current),
          ...Object.values(awayStatsRef.current),
        ].filter(s => !s.didNotPlay).map(toApi)

        const sRes = await bulkUpsertStats(gameId, allStats)

        // Broadcast stats to other scorers
        if (sRes?.data?.data) {
          socketRef.current?.emit('boxScoreUpdate', {
            gameId,
            stats: sRes.data.data,
          })
        }
      } catch { /* silent — will retry on next change */ }
    }, SAVE_DEBOUNCE)
  }, [gameId])

  // ── Load ──────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [gRes, sRes] = await Promise.all([getGameById(gameId), getGameStats(gameId)])
      const g = gRes.data.data

      if (g.status === 'final') {
        addToast('This game is finalized.', 'error')
        navigate('/games'); return
      }

      setGame(g)
      const q = g.currentQuarter || 1
      setCurQ(q); curQRef.current = q
      const cs = parseClock(g.gameClock)
      setClockSecs(cs); clockSecRef.current = cs

      const hq = g.homeQuarterScores || { q1:0,q2:0,q3:0,q4:0,ot:0 }
      const aq = g.awayQuarterScores || { q1:0,q2:0,q3:0,q4:0,ot:0 }
      homeQSRef.current = hq; awayQSRef.current = aq
      setHomeQS(hq); setAwayQS(aq)

      const homeId = g.homeTeam?._id || g.homeTeam
      const awayId = g.awayTeam?._id || g.awayTeam
      const [hRes, aRes] = await Promise.all([getPlayers(homeId), getPlayers(awayId)])
      setHomePlayers(hRes.data.data)
      setAwayPlayers(aRes.data.data)

      const existing = sRes.data.data
      let saved = {}
      try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY(gameId)) || '{}') } catch {}

      // Reset pmEntry for this fresh load
      pmEntryRef.current = new Map()

      const buildMap = (players, teamId) => {
        const map = {}
        players.forEach(p => {
          const found   = existing.find(s => (s.player?._id || s.player) === p._id)
          const onCourt = saved[p._id] !== undefined ? saved[p._id] : (found?.isStarter || false)
          map[p._id] = found
            ? { ...found, onCourt, _playerInfo: p, _secondsPlayed: (found.minutesPlayed||0)*60 }
            : mkBlank(p, teamId, onCourt)

          // Seed pmEntry for players already on court at load time
          // We use current scores as their baseline (can't know the real entry point)
          if (onCourt) {
            pmEntryRef.current.set(p._id, { homeScore: sumQS(hq), awayScore: sumQS(aq) })
          }
        })
        return map
      }

      const hMap = buildMap(hRes.data.data, homeId)
      const aMap = buildMap(aRes.data.data, awayId)
      homeStatsRef.current = hMap; awayStatsRef.current = aMap
      setHomeStats(hMap); setAwayStats(aMap)
    } catch { addToast('Failed to load game', 'error') }
    finally  { setLoading(false) }
  }, [gameId])

  useEffect(() => { load() }, [load])

  // ── Persist on-court ──────────────────────────────────
  const persistCourt = useCallback((hMap, aMap) => {
    const m = {}
    ;[...Object.values(hMap), ...Object.values(aMap)].forEach(s => { m[s.player] = !!s.onCourt })
    try { localStorage.setItem(STORAGE_KEY(gameId), JSON.stringify(m)) } catch {}
  }, [gameId])

  // ── Spacebar ──────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      if (e.code === 'Space' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName)) {
        e.preventDefault(); setRunning(r => !r)
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // ── Clock tick ────────────────────────────────────────
  useEffect(() => {
    if (running) {
      clockInterval.current = setInterval(() => {
        setClockSecs(s => {
          const next = s <= 1 ? 0 : s - 1
          clockSecRef.current = next
          if (next === 0) { setRunning(false); addToast(`Q${curQRef.current} ended!`, 'info') }
          return next
        })
        const tick = (prev) => {
          let changed = false
          const next = { ...prev }
          Object.keys(next).forEach(pid => {
            if (next[pid].onCourt && !next[pid].didNotPlay) {
              const sp = (next[pid]._secondsPlayed||0) + 1
              next[pid] = { ...next[pid], _secondsPlayed: sp, minutesPlayed: parseFloat((sp/60).toFixed(2)) }
              changed = true
            }
          })
          return changed ? next : prev
        }
        setHomeStats(tick)
        setAwayStats(tick)
      }, 1000)
    } else {
      clearInterval(clockInterval.current)
    }
    return () => clearInterval(clockInterval.current)
  }, [running])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => save(), 8000)
    return () => clearInterval(t)
  }, [running, save])

  // ─────────────────────────────────────────────────────
  // CORE STAT UPDATER
  //
  // All computation happens INSIDE the setState updater
  // (synchronous, no async gap):
  //   1. Apply the stat change to the player
  //   2. Compute new team points from the updated map
  //   3. Compute new QS (current quarter = totalPts - otherQuarters)
  //   4. Update QS refs immediately
  //   5. Recompute +/- for ALL on-court players on BOTH sides
  //      using the fresh QS values and our per-instance pmEntryRef
  //   6. Return the patched map to React
  //   7. Separately call setHomeQS/setAwayQS for scoreboard render
  // ─────────────────────────────────────────────────────

  const applyStatChange = useCallback((side, pid, buildNext) => {
    const isHome   = side === 'home'
    const setter   = isHome ? setHomeStats : setAwayStats
    const myRef    = isHome ? homeStatsRef : awayStatsRef
    const otherRef = isHome ? awayStatsRef : homeStatsRef
    const myQSRef  = isHome ? homeQSRef    : awayQSRef
    const otQSRef  = isHome ? awayQSRef    : homeQSRef

    let newHomeQS = null
    let newAwayQS = null

    setter(prev => {
      const old      = prev[pid] || {}
      const next     = buildNext(old)
      const isScore  = ['fgMade','threePtMade','ftMade'].includes(next._changedKey)

      // Remove internal tag
      delete next._changedKey

      const newMap = { ...prev, [pid]: next }

      if (isScore) {
        // ── 1. New team total from updated map ──────────
        const myPts = sumMapPts(newMap)

        // ── 2. New QS: set current quarter, keep others ─
        const qKey    = QKEY(curQRef.current)
        const prevQS  = myQSRef.current
        const others  = Object.entries(prevQS)
          .filter(([k]) => k !== qKey)
          .reduce((a, [, v]) => a + v, 0)
        const newQS   = { ...prevQS, [qKey]: Math.max(0, myPts - others) }

        // ── 3. Update QS refs NOW (synchronous) ─────────
        myQSRef.current = newQS

        // ── 4. Fresh totals for +/- computation ─────────
        const hPts = isHome ? sumQS(newQS)         : sumQS(homeQSRef.current)
        const aPts = isHome ? sumQS(awayQSRef.current) : sumQS(newQS)

        // ── 5. Patch +/- in both maps ────────────────────
        const myPatched    = recalcPM(newMap,            side,                   hPts, aPts, pmEntryRef.current)
        const otherPatched = recalcPM(otherRef.current,  isHome ? 'away':'home', hPts, aPts, pmEntryRef.current)

        myRef.current = myPatched

        if (otherPatched !== otherRef.current) {
          otherRef.current = otherPatched
          if (isHome) setAwayStats(otherPatched)
          else        setHomeStats(otherPatched)
        }

        // ── 6. Store new QS for render (outside setter) ─
        // We can't call setHomeQS inside a setState updater without
        // scheduling, so we capture the value and call it after.
        newHomeQS = isHome ? newQS : homeQSRef.current
        newAwayQS = isHome ? awayQSRef.current : newQS

        return myPatched
      }

      myRef.current = newMap
      return newMap
    })

    // Update QS state for scoreboard render
    // (called synchronously after setter — React batches these)
    if (newHomeQS) setHomeQS(newHomeQS)
    if (newAwayQS) setAwayQS(newAwayQS)

    save()
  }, [save])

  // ── incStat ───────────────────────────────────────────
  const incStat = useCallback((side, pid, key) => {
    applyStatChange(side, pid, (old) => {
      const next = { ...old, [key]: (old[key]||0) + 1, _changedKey: key }

      if (key === 'fgMade')      { next.fgAttempts      = (old.fgAttempts     ||0)+1 }
      if (key === 'threePtMade') {
        next.threePtAttempts = (old.threePtAttempts||0)+1
        next.fgMade          = (old.fgMade         ||0)+1
        next.fgAttempts      = (old.fgAttempts     ||0)+1
      }
      if (key === 'ftMade')      { next.ftAttempts = (old.ftAttempts||0)+1 }

      if (['fgMade','threePtMade','ftMade'].includes(key)) {
        next.points = calcPts(next)
      }
      if (key === 'offRebounds' || key === 'defRebounds') {
        next.totalRebounds = (next.offRebounds||0) + (next.defRebounds||0)
      }
      if (key === 'personalFouls') {
        setTeamFouls(tf => {
          const q = curQRef.current
          const u = { ...tf, [side]: { ...tf[side], [q]: (tf[side][q]||0)+1 } }
          tfRef.current = u; return u
        })
      }
      return next
    })
  }, [applyStatChange])

  // ── decStat ───────────────────────────────────────────
  const decStat = useCallback((side, pid, key) => {
    applyStatChange(side, pid, (old) => {
      const next = { ...old, [key]: Math.max(0,(old[key]||0)-1), _changedKey: key }

      if (['fgMade','threePtMade','ftMade'].includes(key)) {
        next.points = calcPts(next)
      }
      if (key === 'offRebounds' || key === 'defRebounds') {
        next.totalRebounds = (next.offRebounds||0) + (next.defRebounds||0)
      }
      if (key === 'personalFouls' && (old[key]||0) > 0) {
        setTeamFouls(tf => {
          const q = curQRef.current
          const u = { ...tf, [side]: { ...tf[side], [q]: Math.max(0,(tf[side][q]||0)-1) } }
          tfRef.current = u; return u
        })
      }
      return next
    })
  }, [applyStatChange])

  // ── Scoreboard manual +/- buttons ────────────────────
  const addQPts = useCallback((side, pts) => {
    const isHome = side === 'home'
    const qKey   = QKEY(curQRef.current)
    const qsRef  = isHome ? homeQSRef : awayQSRef
    const newQS  = { ...qsRef.current, [qKey]: (qsRef.current[qKey]||0) + pts }
    qsRef.current = newQS
    if (isHome) setHomeQS(newQS); else setAwayQS(newQS)

    const hPts = sumQS(homeQSRef.current)
    const aPts = sumQS(awayQSRef.current)
    setHomeStats(prev => { const n=recalcPM(prev,'home',hPts,aPts,pmEntryRef.current); homeStatsRef.current=n; return n })
    setAwayStats(prev => { const n=recalcPM(prev,'away',hPts,aPts,pmEntryRef.current); awayStatsRef.current=n; return n })
    save()
  }, [save])

  const subQPts = useCallback((side) => {
    const isHome = side === 'home'
    const qKey   = QKEY(curQRef.current)
    const qsRef  = isHome ? homeQSRef : awayQSRef
    const newQS  = { ...qsRef.current, [qKey]: Math.max(0,(qsRef.current[qKey]||0)-1) }
    qsRef.current = newQS
    if (isHome) setHomeQS(newQS); else setAwayQS(newQS)

    const hPts = sumQS(homeQSRef.current)
    const aPts = sumQS(awayQSRef.current)
    setHomeStats(prev => { const n=recalcPM(prev,'home',hPts,aPts,pmEntryRef.current); homeStatsRef.current=n; return n })
    setAwayStats(prev => { const n=recalcPM(prev,'away',hPts,aPts,pmEntryRef.current); awayStatsRef.current=n; return n })
    save()
  }, [save])

  const addTF = useCallback((side) => {
    setTeamFouls(tf => {
      const q=curQRef.current; const u={...tf,[side]:{...tf[side],[q]:(tf[side][q]||0)+1}}
      tfRef.current=u; return u
    }); save()
  }, [save])

  const subTF = useCallback((side) => {
    setTeamFouls(tf => {
      const q=curQRef.current; const u={...tf,[side]:{...tf[side],[q]:Math.max(0,(tf[side][q]||0)-1)}}
      tfRef.current=u; return u
    }); save()
  }, [save])

  // ── Quarter change ────────────────────────────────────
  const changeQuarter = useCallback((q) => {
    setCurQ(q); curQRef.current = q
    setClockSecs(QUARTER_DURATION); clockSecRef.current = QUARTER_DURATION
    setRunning(false)
    addToast(`Q${q===5?'OT':q} — team fouls reset`, 'info')
    save()
  }, [save])

  // ── Toggle on-court ───────────────────────────────────
  const toggleCourt = useCallback((side, pid) => {
    const isHome = side === 'home'
    const setter = isHome ? setHomeStats : setAwayStats
    const myRef  = isHome ? homeStatsRef : awayStatsRef

    setter(prev => {
      const wasOn = prev[pid]?.onCourt || false
      const next  = { ...prev, [pid]: { ...prev[pid], onCourt: !wasOn } }

      if (!wasOn) {
        // Entering — record current score as +/- baseline
        pmEntryRef.current.set(pid, {
          homeScore: sumQS(homeQSRef.current),
          awayScore: sumQS(awayQSRef.current),
        })
        // Reset their +/- to 0 when stepping on
        next[pid] = { ...next[pid], plusMinus: 0 }
      } else {
        // Leaving — freeze current +/- value
        const e = pmEntryRef.current.get(pid)
        if (e) {
          const hPts = sumQS(homeQSRef.current)
          const aPts = sumQS(awayQSRef.current)
          const pm   = side === 'home'
            ? (hPts - e.homeScore) - (aPts - e.awayScore)
            : (aPts - e.awayScore) - (hPts - e.homeScore)
          next[pid] = { ...next[pid], plusMinus: pm }
        }
      }

      myRef.current = next
      persistCourt(isHome ? next : homeStatsRef.current,
                   isHome ? awayStatsRef.current : next)
      return next
    })
    save()
  }, [persistCourt, save])

  // ── Drag & drop ───────────────────────────────────────
  const startDrag  = (pid, side) => { setDragPid(pid); setDragSide(side) }
  const overDrag   = (e, pid)    => { e.preventDefault(); setDragOver(pid) }
  const endDrag    = ()          => { setDragPid(null); setDragSide(null); setDragOver(null) }

  const dropOnPlayer = useCallback((e, targetPid, side) => {
    e.preventDefault()
    if (!dragPid || dragSide !== side || dragPid === targetPid) { endDrag(); return }
    const setter = side === 'home' ? setHomeStats : setAwayStats
    setter(prev => {
      const next = {
        ...prev,
        [dragPid]:   { ...prev[dragPid],   onCourt: prev[targetPid]?.onCourt },
        [targetPid]: { ...prev[targetPid], onCourt: prev[dragPid]?.onCourt   },
      }
      if (side==='home') homeStatsRef.current=next; else awayStatsRef.current=next
      persistCourt(side==='home'?next:homeStatsRef.current, side==='away'?next:awayStatsRef.current)
      return next
    })
    endDrag(); save()
  }, [dragPid, dragSide, persistCourt, save])

  const dropZone = useCallback((e, zone, side) => {
    e.preventDefault()
    if (!dragPid || dragSide !== side) { endDrag(); return }
    const setter = side === 'home' ? setHomeStats : setAwayStats
    setter(prev => {
      const next = { ...prev, [dragPid]: { ...prev[dragPid], onCourt: zone==='court' } }
      if (side==='home') homeStatsRef.current=next; else awayStatsRef.current=next
      persistCourt(side==='home'?next:homeStatsRef.current, side==='away'?next:awayStatsRef.current)
      return next
    })
    endDrag(); save()
  }, [dragPid, dragSide, persistCourt, save])

  // ── Finalize ──────────────────────────────────────────
  const finalize = useCallback(async () => {
    setShowConfirm(false)
    try {
      const markDNP = (m) => {
        const n = { ...m }
        Object.keys(n).forEach(pid => {
          if ((n[pid]._secondsPlayed||0) === 0) n[pid] = { ...n[pid], didNotPlay:true }
        })
        return n
      }
      const fh = markDNP(homeStatsRef.current)
      const fa = markDNP(awayStatsRef.current)
      const hq = homeQSRef.current; const aq = awayQSRef.current
      await updateGame(gameId, {
        status:'final', homeScore:sumQS(hq), awayScore:sumQS(aq),
        homeQuarterScores:hq, awayQuarterScores:aq, gameClock:'00:00',
      })
      await bulkUpsertStats(gameId, [...Object.values(fh),...Object.values(fa)].map(toApi))
      try { localStorage.removeItem(STORAGE_KEY(gameId)) } catch {}
      socketRef.current?.emit('scoreboardUpdate', { game:{ status:'final' } })
      addToast('Game finalized! 🏆', 'success')
      navigate('/games')
    } catch { addToast('Failed to finalize', 'error') }
  }, [gameId, navigate])

  // ── Derived ───────────────────────────────────────────
  const homeTotal = sumQS(homeQS)
  const awayTotal = sumQS(awayQS)
  const homeFouls = teamFouls.home[curQ] || 0
  const awayFouls = teamFouls.away[curQ] || 0
  const qLabel    = ['1ST','2ND','3RD','4TH','OT'][curQ-1] || `Q${curQ}`

  const curStats  = activeTeam==='home' ? homeStats  : awayStats
  const curPList  = activeTeam==='home' ? homePlayers : awayPlayers
  const curSide   = activeTeam

  const onCourt   = curPList.filter(p =>  curStats[p._id]?.onCourt && !curStats[p._id]?.didNotPlay)
  const bench     = curPList.filter(p => !curStats[p._id]?.onCourt && !curStats[p._id]?.didNotPlay)
  const homeOnCnt = homePlayers.filter(p => homeStats[p._id]?.onCourt).length
  const awayOnCnt = awayPlayers.filter(p => awayStats[p._id]?.onCourt).length

  if (loading) return (
    <div style={{padding:32}}>
      <div className="skeleton" style={{height:160,borderRadius:12,marginBottom:12}}/>
      <div className="skeleton" style={{height:420,borderRadius:12}}/>
    </div>
  )
  if (!game) return (
    <div style={{padding:40}}>
      <p style={{color:'var(--red)'}}>Game not found.</p>
      <Link to="/games" style={{color:'var(--gold)'}}>← Back</Link>
    </div>
  )

  return (
    <div className="scorer-root">
      {showConfirm && (
        <ConfirmModal
          title="Finalize Game?"
          message="This permanently locks the game. Players with 0 minutes will be marked DNP. This cannot be undone."
          onConfirm={finalize}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* ── Top bar ──────────────────────────────── */}
      <div className="scorer-topbar">
        <div className="scorer-topbar__left">
          <Link to="/games" className="scorer-topbar__back">← Back</Link>
          <span className="scorer-topbar__title">
            {game.awayTeam?.abbreviation}
            <span className="scorer-topbar__vs"> @ </span>
            {game.homeTeam?.abbreviation}
          </span>
          <span className="badge badge-live"><span className="live-dot"/>LIVE · {qLabel}</span>
          <span className="scorer-topbar__autosave">● Auto-saving</span>
        </div>
        <button onClick={() => setShowConfirm(true)} className="btn btn-green btn-sm">✓ Finalize</button>
      </div>

      {/* ── Scoreboard ───────────────────────────── */}
      <div className="scorer-board">
        {/* Away */}
        <div className="scorer-board__team scorer-board__team--away">
          <div className="scorer-board__label">AWAY · {game.awayTeam?.abbreviation}</div>
          <div className="scorer-board__score-row">
            <span className={`scorer-board__score${awayTotal>homeTotal?' scorer-board__score--leading':''}`}>{awayTotal}</span>
            <div className="scorer-board__controls">
              <div className="scorer-board__pts-btns">
                <button className="sc-btn sc-btn--red" onClick={() => subQPts('away')}>−1</button>
                {[1,2,3].map(n => <button key={n} className="sc-btn" onClick={() => addQPts('away',n)}>+{n}</button>)}
              </div>
              <div className="scorer-board__fouls-row">
                <span className="scorer-board__fouls-label">FOULS Q{curQ}:</span>
                <button className="sc-foul-btn" onClick={() => subTF('away')}>−</button>
                <span className={`scorer-board__foul-count${awayFouls>=5?' scorer-board__foul-count--bonus':''}`}>{awayFouls}</span>
                <button className="sc-foul-btn" onClick={() => addTF('away')}>+</button>
                {awayFouls>=5 && <span className="scorer-board__bonus-tag">BONUS</span>}
              </div>
            </div>
          </div>
          <div className="scorer-board__qscores">
            {['q1','q2','q3','q4','ot'].map((q,i)=>(
              <div key={q} className="scorer-board__qscore">
                <div className="scorer-board__qscore-label">{q.toUpperCase()}</div>
                <div className={`scorer-board__qscore-val${i+1===curQ?' scorer-board__qscore-val--active':''}`}>{awayQS[q]||0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Clock */}
        <div className="scorer-clock">
          <button
            className={`scorer-clock__btn${running?' scorer-clock__btn--running':clockSecs===0?' scorer-clock__btn--ended':''}`}
            onClick={() => setRunning(r=>!r)}
            title="SPACE to toggle"
          >{fmtClock(clockSecs)}</button>
          <div className="scorer-clock__hint">{running?'▶ SPACE TO PAUSE':'⏸ SPACE TO START'}</div>
          <div className="scorer-clock__quarters">
            {[1,2,3,4,5].map(q=>(
              <button key={q} className={`scorer-clock__q${curQ===q?' scorer-clock__q--active':''}`} onClick={()=>changeQuarter(q)}>
                {q===5?'OT':`Q${q}`}
              </button>
            ))}
          </div>
          <button className="scorer-clock__reset" onClick={()=>{setRunning(false);setClockSecs(QUARTER_DURATION);clockSecRef.current=QUARTER_DURATION}}>↺ Reset</button>
        </div>

        {/* Home */}
        <div className="scorer-board__team scorer-board__team--home">
          <div className="scorer-board__label">HOME · {game.homeTeam?.abbreviation}</div>
          <div className="scorer-board__score-row scorer-board__score-row--right">
            <div className="scorer-board__controls">
              <div className="scorer-board__pts-btns">
                {[1,2,3].map(n=><button key={n} className="sc-btn" onClick={()=>addQPts('home',n)}>+{n}</button>)}
                <button className="sc-btn sc-btn--red" onClick={()=>subQPts('home')}>−1</button>
              </div>
              <div className="scorer-board__fouls-row scorer-board__fouls-row--right">
                {homeFouls>=5 && <span className="scorer-board__bonus-tag">BONUS</span>}
                <button className="sc-foul-btn" onClick={()=>subTF('home')}>−</button>
                <span className={`scorer-board__foul-count${homeFouls>=5?' scorer-board__foul-count--bonus':''}`}>{homeFouls}</span>
                <button className="sc-foul-btn" onClick={()=>addTF('home')}>+</button>
                <span className="scorer-board__fouls-label">FOULS Q{curQ}</span>
              </div>
            </div>
            <span className={`scorer-board__score${homeTotal>awayTotal?' scorer-board__score--leading':''}`}>{homeTotal}</span>
          </div>
          <div className="scorer-board__qscores scorer-board__qscores--right">
            {['q1','q2','q3','q4','ot'].map((q,i)=>(
              <div key={q} className="scorer-board__qscore">
                <div className="scorer-board__qscore-label">{q.toUpperCase()}</div>
                <div className={`scorer-board__qscore-val${i+1===curQ?' scorer-board__qscore-val--active':''}`}>{homeQS[q]||0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────── */}
      <div className="scorer-body">
        {/* Team tabs */}
        <div className="scorer-tabs">
          {[{key:'away',team:game.awayTeam,count:awayOnCnt},{key:'home',team:game.homeTeam,count:homeOnCnt}].map(({key,team:t,count})=>(
            <button key={key} className={`scorer-tab${activeTeam===key?' scorer-tab--active':''}`} onClick={()=>setActiveTeam(key)}>
              {t?.abbreviation} · {key==='home'?'Home':'Away'}
              <span className={`scorer-tab__count${activeTeam===key&&count>0?' scorer-tab__count--active':''}`}>{count}/5</span>
            </button>
          ))}
        </div>

        <div className="scorer-split">
          {/* Roster panel */}
          <div className="roster-panel">
            {/* On Court */}
            <div className="roster-zone roster-zone--court" onDragOver={e=>e.preventDefault()} onDrop={e=>dropZone(e,'court',curSide)}>
              <div className="roster-zone__label roster-zone__label--court">
                <span className="roster-zone__dot"/>ON COURT ({onCourt.length}/5)
              </div>
              {onCourt.map(p=>{
                const s=curStats[p._id]; const sp=s?._secondsPlayed||0
                return (
                  <div key={p._id} draggable
                    onDragStart={()=>startDrag(p._id,curSide)} onDragOver={e=>overDrag(e,p._id)}
                    onDrop={e=>dropOnPlayer(e,p._id,curSide)} onDragEnd={endDrag}
                    onClick={()=>toggleCourt(curSide,p._id)}
                    className={`roster-card roster-card--court${dragOver===p._id?' roster-card--drag-over':''}`}>
                    <div className="roster-card__num">{p.jerseyNumber}</div>
                    <div className="roster-card__info">
                      <div className="roster-card__name">{p.firstName[0]}. {p.lastName}</div>
                      <div className="roster-card__sub">{Math.floor(sp/60)}:{String(Math.round(sp%60)).padStart(2,'0')} · {p.position}</div>
                    </div>
                    <span className="roster-card__pts">{s?.points||0}</span>
                  </div>
                )
              })}
              {onCourt.length===0 && <div className="roster-zone__empty">Drag or click to add</div>}
            </div>
            {/* Bench */}
            <div className="roster-zone roster-zone--bench" onDragOver={e=>e.preventDefault()} onDrop={e=>dropZone(e,'bench',curSide)}>
              <div className="roster-zone__label">BENCH ({bench.length})</div>
              {bench.map(p=>{
                const s=curStats[p._id]
                return (
                  <div key={p._id} draggable
                    onDragStart={()=>startDrag(p._id,curSide)} onDragOver={e=>overDrag(e,p._id)}
                    onDrop={e=>dropOnPlayer(e,p._id,curSide)} onDragEnd={endDrag}
                    onClick={()=>toggleCourt(curSide,p._id)}
                    className={`roster-card${dragOver===p._id?' roster-card--drag-over':''}`}>
                    <div className="roster-card__num">{p.jerseyNumber}</div>
                    <div className="roster-card__info">
                      <div className="roster-card__name">{p.firstName[0]}. {p.lastName}</div>
                      <div className="roster-card__sub">{p.position}</div>
                    </div>
                    <span className="roster-card__pts">{s?.points||0}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stats table */}
          <div className="stats-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Player</th>
                  {COLS.map(c=>(
                    <th key={c.key} className={c.key==='points'?'col-pts':c.pf?'col-pf':c.makes?'col-makes':''}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {onCourt.length > 0 && (
                  <tr className="section-header section-header--court">
                    <td colSpan={COLS.length+1}>⬤ On Court</td>
                  </tr>
                )}
                {onCourt.map(p => (
                  <PlayerRow key={p._id} player={p}
                    s={curStats[p._id] || mkBlank(p, game[`${curSide}Team`]?._id, true)}
                    isOn={true} side={curSide} onInc={incStat} onDec={decStat}
                  />
                ))}
                {bench.length > 0 && (
                  <tr className="section-header section-header--bench">
                    <td colSpan={COLS.length+1}>— Bench</td>
                  </tr>
                )}
                {bench.map(p => (
                  <PlayerRow key={p._id} player={p}
                    s={curStats[p._id] || mkBlank(p, game[`${curSide}Team`]?._id, false)}
                    isOn={false} side={curSide} onInc={incStat} onDec={decStat}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}