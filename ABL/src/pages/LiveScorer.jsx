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
const EMIT_DEBOUNCE    = 500
const STORAGE_KEY      = (gid) => `abl_oncourt_${gid}`

// ─── Helpers ──────────────────────────────────────────────
const fmtClock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const parseClock = (str) => {
  const [m, sec] = (str || '10:00').split(':').map(Number)
  return ((m || 0) * 60) + (sec || 0)
}

// Points = (FGM - 3PM)*2 + 3PM*3 + FTM
const calcPoints = (s) =>
  Math.max(0, (s.fgMade || 0) - (s.threePtMade || 0)) * 2 +
  (s.threePtMade || 0) * 3 +
  (s.ftMade || 0)

// Sum quarter scores object → total score
const sumQS = (qs) => Object.values(qs).reduce((a, b) => a + b, 0)

// Sum all player points from a stats map
const sumPlayerPts = (map) =>
  Object.values(map).reduce((acc, s) => acc + (s.points || 0), 0)

const QUARTER_KEY = (q) => (q <= 4 ? `q${q}` : 'ot')

const toApiStat = ({
  _playerInfo, onCourt, _secondsPlayed,
  _id, __v, createdAt, updatedAt,
  ...rest
}) => rest

const mkBlank = (player, teamId, onCourt = false) => ({
  player: player._id,
  team: teamId,
  isStarter: onCourt,
  didNotPlay: false,
  onCourt,
  points: 0,
  fgMade: 0, fgAttempts: 0,
  threePtMade: 0, threePtAttempts: 0,
  ftMade: 0, ftAttempts: 0,
  offRebounds: 0, defRebounds: 0, totalRebounds: 0,
  assists: 0, steals: 0, blocks: 0,
  turnovers: 0, personalFouls: 0,
  plusMinus: 0,
  minutesPlayed: 0,
  _secondsPlayed: 0,
  _playerInfo: player,
})

// ─── Stat columns ─────────────────────────────────────────
const COLS = [
  { key: 'points',          label: 'PTS', readonly: true  },
  { key: 'fgMade',          label: 'FGM', makes: true     },
  { key: 'fgAttempts',      label: 'FGA'                  },
  { key: 'threePtMade',     label: '3PM', makes: true     },
  { key: 'threePtAttempts', label: '3PA'                  },
  { key: 'ftMade',          label: 'FTM', makes: true     },
  { key: 'ftAttempts',      label: 'FTA'                  },
  { key: 'offRebounds',     label: 'OR'                   },
  { key: 'defRebounds',     label: 'DR'                   },
  { key: 'totalRebounds',   label: 'REB', readonly: true  },
  { key: 'assists',         label: 'AST'                  },
  { key: 'steals',          label: 'STL'                  },
  { key: 'blocks',          label: 'BLK'                  },
  { key: 'turnovers',       label: 'TO'                   },
  { key: 'personalFouls',   label: 'PF',  pf: true        },
  { key: 'plusMinus',       label: '+/−', readonly: true, pm: true },
  { key: 'minutesPlayed',   label: 'MIN', readonly: true  },
]

// ─── Confirm Modal ────────────────────────────────────────
const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="confirm-overlay">
    <div className="confirm-box">
      <div className="confirm-box__icon">🏆</div>
      <div className="confirm-box__title">{title}</div>
      <p className="confirm-box__msg">{message}</p>
      <div className="confirm-box__actions">
        <button onClick={onCancel} className="btn btn-outline">Cancel</button>
        <button onClick={onConfirm} className="btn btn-green btn-lg">Yes, Finalize Game</button>
      </div>
    </div>
  </div>
)

// ─── Main Component ───────────────────────────────────────
export default function LiveScorer() {
  const { gameId }    = useParams()
  const { addToast }  = useToast()
  const navigate      = useNavigate()

  const [game, setGame]                 = useState(null)
  const [homeStats, setHomeStats]       = useState({})
  const [awayStats, setAwayStats]       = useState({})
  const [homePlayers, setHomePlayers]   = useState([])
  const [awayPlayers, setAwayPlayers]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [activeTeam, setActiveTeam]     = useState('home')
  const [showConfirm, setShowConfirm]   = useState(false)

  const [clockSecs, setClockSecs]       = useState(QUARTER_DURATION)
  const [running, setRunning]           = useState(false)
  const [currentQuarter, setCurrentQ]   = useState(1)

  const [homeQS, setHomeQS] = useState({ q1:0,q2:0,q3:0,q4:0,ot:0 })
  const [awayQS, setAwayQS] = useState({ q1:0,q2:0,q3:0,q4:0,ot:0 })

  const [teamFouls, setTeamFouls] = useState({
    home: {1:0,2:0,3:0,4:0,5:0},
    away: {1:0,2:0,3:0,4:0,5:0},
  })

  const [dragPid,  setDragPid]  = useState(null)
  const [dragSide, setDragSide] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  // ── Refs ───────────────────────────────────────────────
  const clockIntervalRef = useRef(null)
  const socketRef        = useRef(null)
  const emitTimer        = useRef(null)

  // These refs are updated synchronously (not via useEffect)
  // so they are always current when used inside callbacks
  const homeStatsRef  = useRef({})
  const awayStatsRef  = useRef({})
  const homeQSRef     = useRef({ q1:0,q2:0,q3:0,q4:0,ot:0 })
  const awayQSRef     = useRef({ q1:0,q2:0,q3:0,q4:0,ot:0 })
  const clockSecRef   = useRef(QUARTER_DURATION)
  const quarterRef    = useRef(1)
  const tfRef         = useRef({ home:{1:0,2:0,3:0,4:0,5:0}, away:{1:0,2:0,3:0,4:0,5:0} })

  // +/- entry scores: { [playerId]: { homeScore, awayScore } }
  // Stored in ref so it's always current inside state updaters
  const pmEntryRef = useRef({})

  // Keep refs sync'd with state (via useEffect is fine for these —
  // they're only read inside scheduleEmit which is always debounced)
  useEffect(() => { homeStatsRef.current = homeStats }, [homeStats])
  useEffect(() => { awayStatsRef.current = awayStats }, [awayStats])
  useEffect(() => { clockSecRef.current  = clockSecs }, [clockSecs])
  useEffect(() => { quarterRef.current   = currentQuarter }, [currentQuarter])
  useEffect(() => { tfRef.current        = teamFouls }, [teamFouls])

  // homeQSRef / awayQSRef need to be updated IMMEDIATELY (not via useEffect)
  // so that +/- calculations inside the same render cycle are accurate
  const setHomeQSImmediate = useCallback((updater) => {
    setHomeQS(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      homeQSRef.current = next   // update ref synchronously
      return next
    })
  }, [])

  const setAwayQSImmediate = useCallback((updater) => {
    setAwayQS(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      awayQSRef.current = next   // update ref synchronously
      return next
    })
  }, [])

  // ── Socket ─────────────────────────────────────────────
  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket
    socket.emit('joinGame', gameId)
    return () => { socket.emit('leaveGame', gameId); socket.disconnect() }
  }, [gameId])

  // ── Auto-save (debounced) ──────────────────────────────
  const scheduleEmit = useCallback(() => {
    clearTimeout(emitTimer.current)
    emitTimer.current = setTimeout(async () => {
      try {
        const hq = homeQSRef.current
        const aq = awayQSRef.current
        const q  = quarterRef.current
        const tf = tfRef.current

        const gRes = await updateGame(gameId, {
          gameClock: fmtClock(clockSecRef.current),
          currentQuarter: q,
          homeScore: sumQS(hq),
          awayScore: sumQS(aq),
          homeQuarterScores: hq,
          awayQuarterScores: aq,
          homeTeamFouls: tf.home[q] || 0,
          awayTeamFouls: tf.away[q] || 0,
        })
        setGame(gRes.data.data)

        const allStats = [
          ...Object.values(homeStatsRef.current),
          ...Object.values(awayStatsRef.current),
        ].filter(s => !s.didNotPlay).map(toApiStat)

        await bulkUpsertStats(gameId, allStats)
        socketRef.current?.emit('scoreboardUpdate', { game: gRes.data.data })
      } catch { /* silent */ }
    }, EMIT_DEBOUNCE)
  }, [gameId])

  // ── Load ───────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [gRes, sRes] = await Promise.all([getGameById(gameId), getGameStats(gameId)])
      const g = gRes.data.data

      if (g.status === 'final') {
        addToast('This game is finalized.', 'error')
        navigate('/games'); return
      }

      setGame(g)
      setCurrentQ(g.currentQuarter || 1)
      setClockSecs(parseClock(g.gameClock))

      const hq = g.homeQuarterScores || { q1:0,q2:0,q3:0,q4:0,ot:0 }
      const aq = g.awayQuarterScores || { q1:0,q2:0,q3:0,q4:0,ot:0 }
      homeQSRef.current = hq
      awayQSRef.current = aq
      setHomeQS(hq)
      setAwayQS(aq)

      const homeId = g.homeTeam?._id || g.homeTeam
      const awayId = g.awayTeam?._id || g.awayTeam

      const [hRes, aRes] = await Promise.all([getPlayers(homeId), getPlayers(awayId)])
      setHomePlayers(hRes.data.data)
      setAwayPlayers(aRes.data.data)

      const existing = sRes.data.data

      let savedCourt = {}
      try {
        const raw = localStorage.getItem(STORAGE_KEY(gameId))
        if (raw) savedCourt = JSON.parse(raw)
      } catch { }

      const buildMap = (players, teamId) => {
        const map = {}
        players.forEach(p => {
          const found   = existing.find(s => (s.player?._id || s.player) === p._id)
          const onCourt = savedCourt[p._id] !== undefined
            ? savedCourt[p._id]
            : (found?.isStarter || false)
          if (found) {
            map[p._id] = {
              ...found, onCourt, _playerInfo: p,
              _secondsPlayed: (found.minutesPlayed || 0) * 60,
            }
          } else {
            map[p._id] = mkBlank(p, teamId, onCourt)
          }
          // Seed pmEntry for players already on court
          if (onCourt) {
            pmEntryRef.current[p._id] = {
              homeScore: sumQS(hq),
              awayScore: sumQS(aq),
            }
          }
        })
        return map
      }

      const hMap = buildMap(hRes.data.data, homeId)
      const aMap = buildMap(aRes.data.data, awayId)
      homeStatsRef.current = hMap
      awayStatsRef.current = aMap
      setHomeStats(hMap)
      setAwayStats(aMap)
    } catch {
      addToast('Failed to load game', 'error')
    } finally { setLoading(false) }
  }, [gameId])

  useEffect(() => { load() }, [load])

  // ── Persist on-court to localStorage ──────────────────
  const persistCourt = useCallback((homeMap, awayMap) => {
    const courtMap = {}
    ;[...Object.values(homeMap), ...Object.values(awayMap)].forEach(s => {
      courtMap[s.player] = s.onCourt || false
    })
    try { localStorage.setItem(STORAGE_KEY(gameId), JSON.stringify(courtMap)) }
    catch { }
  }, [gameId])

  // ── Spacebar ───────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      if (e.code === 'Space' &&
          !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName)) {
        e.preventDefault()
        setRunning(r => !r)
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // ── Clock tick ─────────────────────────────────────────
  useEffect(() => {
    if (running) {
      clockIntervalRef.current = setInterval(() => {
        setClockSecs(s => {
          if (s <= 1) { setRunning(false); addToast(`Q${quarterRef.current} ended!`, 'info'); return 0 }
          return s - 1
        })
        const tick = (prev) => {
          let changed = false
          const next = { ...prev }
          Object.keys(next).forEach(pid => {
            if (next[pid].onCourt && !next[pid].didNotPlay) {
              const sp = (next[pid]._secondsPlayed || 0) + 1
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
      clearInterval(clockIntervalRef.current)
    }
    return () => clearInterval(clockIntervalRef.current)
  }, [running])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => scheduleEmit(), 10000)
    return () => clearInterval(t)
  }, [running, scheduleEmit])

  // ─────────────────────────────────────────────────────────
  // THE FIX: +/- is calculated inline, using the NEW quarter
  // score AFTER the point is added — no stale refs, no delay.
  //
  // Strategy:
  //  1. incStat/decStat updates the stats map AND the QS in one
  //     synchronous pass, then immediately recalculates +/- for
  //     all on-court players using the already-updated QS ref.
  //  2. pmEntryRef is a plain object ref — always current.
  // ─────────────────────────────────────────────────────────

  // Compute +/- for a player given the CURRENT (just-updated) QS values
  const computePM = useCallback((pid, side, newHomeQS, newAwayQS) => {
    const entry = pmEntryRef.current[pid]
    if (!entry) return 0
    const homePts = sumQS(newHomeQS)
    const awayPts = sumQS(newAwayQS)
    if (side === 'home') return (homePts - entry.homeScore) - (awayPts - entry.awayScore)
    else                 return (awayPts - entry.awayScore) - (homePts - entry.homeScore)
  }, [])

  // Update +/- for every on-court player on BOTH sides
  // given freshly-computed homeQS and awayQS values
  const applyPlusMinus = useCallback((newHomeQS, newAwayQS) => {
    setHomeStats(prev => {
      const next = { ...prev }
      let changed = false
      Object.keys(next).forEach(pid => {
        if (next[pid].onCourt && !next[pid].didNotPlay) {
          const pm = computePM(pid, 'home', newHomeQS, newAwayQS)
          if (pm !== next[pid].plusMinus) { next[pid] = { ...next[pid], plusMinus: pm }; changed = true }
        }
      })
      return changed ? next : prev
    })
    setAwayStats(prev => {
      const next = { ...prev }
      let changed = false
      Object.keys(next).forEach(pid => {
        if (next[pid].onCourt && !next[pid].didNotPlay) {
          const pm = computePM(pid, 'away', newHomeQS, newAwayQS)
          if (pm !== next[pid].plusMinus) { next[pid] = { ...next[pid], plusMinus: pm }; changed = true }
        }
      })
      return changed ? next : prev
    })
  }, [computePM])

  // Sync player points → current quarter score, return new QS
  // Returns the updated QS object so callers can use it immediately
  const syncQScoreAndGetNew = useCallback((side, statsMap) => {
    const totalPts = sumPlayerPts(statsMap)
    const qKey     = QUARTER_KEY(quarterRef.current)
    const setQS    = side === 'home' ? setHomeQSImmediate : setAwayQSImmediate
    const qsRef    = side === 'home' ? homeQSRef          : awayQSRef

    let newQS = qsRef.current
    setQS(prev => {
      const otherSum = Object.entries(prev)
        .filter(([k]) => k !== qKey)
        .reduce((sum, [, v]) => sum + v, 0)
      const newVal = Math.max(0, totalPts - otherSum)
      if (newVal === prev[qKey]) { newQS = prev; return prev }
      newQS = { ...prev, [qKey]: newVal }
      return newQS
    })
    return newQS
  }, [setHomeQSImmediate, setAwayQSImmediate])

  // ── incStat ────────────────────────────────────────────
  const incStat = useCallback((side, pid, key) => {
    const setter = side === 'home' ? setHomeStats : setAwayStats
    let updatedMap = null

    setter(prev => {
      const old  = prev[pid] || {}
      const next = { ...old, [key]: (old[key] || 0) + 1 }

      if (key === 'fgMade')      { next.fgAttempts      = (old.fgAttempts      || 0) + 1 }
      if (key === 'threePtMade') {
        next.threePtAttempts = (old.threePtAttempts || 0) + 1
        next.fgMade          = (old.fgMade          || 0) + 1
        next.fgAttempts      = (old.fgAttempts      || 0) + 1
      }
      if (key === 'ftMade') { next.ftAttempts = (old.ftAttempts || 0) + 1 }

      if (['fgMade','threePtMade','ftMade'].includes(key)) {
        next.points = calcPoints(next)
      }
      if (key === 'offRebounds' || key === 'defRebounds') {
        next.totalRebounds = (next.offRebounds || 0) + (next.defRebounds || 0)
      }
      if (key === 'personalFouls') {
        setTeamFouls(tf => {
          const q = quarterRef.current
          const updated = { ...tf, [side]: { ...tf[side], [q]: (tf[side][q] || 0) + 1 } }
          tfRef.current = updated
          return updated
        })
      }

      updatedMap = { ...prev, [pid]: next }
      // Update ref synchronously so syncQScoreAndGetNew can read it
      if (side === 'home') homeStatsRef.current = updatedMap
      else                 awayStatsRef.current = updatedMap
      return updatedMap
    })

    // Sync quarter score and immediately apply fresh +/- using the new QS
    if (['fgMade','threePtMade','ftMade'].includes(key)) {
      // Use requestAnimationFrame instead of setTimeout to run after React
      // flushes the setState above — guarantees updatedMap ref is set
      requestAnimationFrame(() => {
        const map = side === 'home' ? homeStatsRef.current : awayStatsRef.current
        const newSideQS   = syncQScoreAndGetNew(side, map)
        const newHomeQS   = side === 'home' ? newSideQS : homeQSRef.current
        const newAwayQS   = side === 'away' ? newSideQS : awayQSRef.current
        applyPlusMinus(newHomeQS, newAwayQS)
        scheduleEmit()
      })
    } else {
      scheduleEmit()
    }
  }, [syncQScoreAndGetNew, applyPlusMinus, scheduleEmit])

  // ── decStat ────────────────────────────────────────────
  const decStat = useCallback((side, pid, key) => {
    const setter = side === 'home' ? setHomeStats : setAwayStats

    setter(prev => {
      const old  = prev[pid] || {}
      const next = { ...old, [key]: Math.max(0, (old[key] || 0) - 1) }

      if (['fgMade','threePtMade','ftMade'].includes(key)) { next.points = calcPoints(next) }
      if (key === 'offRebounds' || key === 'defRebounds') {
        next.totalRebounds = (next.offRebounds || 0) + (next.defRebounds || 0)
      }
      if (key === 'personalFouls' && (old[key] || 0) > 0) {
        setTeamFouls(tf => {
          const q = quarterRef.current
          const updated = { ...tf, [side]: { ...tf[side], [q]: Math.max(0, (tf[side][q] || 0) - 1) } }
          tfRef.current = updated
          return updated
        })
      }

      const newMap = { ...prev, [pid]: next }
      if (side === 'home') homeStatsRef.current = newMap
      else                 awayStatsRef.current = newMap
      return newMap
    })

    if (['fgMade','threePtMade','ftMade'].includes(key)) {
      requestAnimationFrame(() => {
        const map = side === 'home' ? homeStatsRef.current : awayStatsRef.current
        const newSideQS = syncQScoreAndGetNew(side, map)
        const newHomeQS = side === 'home' ? newSideQS : homeQSRef.current
        const newAwayQS = side === 'away' ? newSideQS : awayQSRef.current
        applyPlusMinus(newHomeQS, newAwayQS)
        scheduleEmit()
      })
    } else {
      scheduleEmit()
    }
  }, [syncQScoreAndGetNew, applyPlusMinus, scheduleEmit])

  // ── Scoreboard override buttons ────────────────────────
  const addQPts = useCallback((side, pts) => {
    const qKey = QUARTER_KEY(currentQuarter)
    const setQS = side === 'home' ? setHomeQSImmediate : setAwayQSImmediate
    setQS(prev => {
      const next = { ...prev, [qKey]: (prev[qKey] || 0) + pts }
      const hqs  = side === 'home' ? next : homeQSRef.current
      const aqs  = side === 'away' ? next : awayQSRef.current
      applyPlusMinus(hqs, aqs)
      return next
    })
    scheduleEmit()
  }, [currentQuarter, setHomeQSImmediate, setAwayQSImmediate, applyPlusMinus, scheduleEmit])

  const subQPts = useCallback((side) => {
    const qKey = QUARTER_KEY(currentQuarter)
    const setQS = side === 'home' ? setHomeQSImmediate : setAwayQSImmediate
    setQS(prev => {
      const next = { ...prev, [qKey]: Math.max(0, (prev[qKey] || 0) - 1) }
      const hqs  = side === 'home' ? next : homeQSRef.current
      const aqs  = side === 'away' ? next : awayQSRef.current
      applyPlusMinus(hqs, aqs)
      return next
    })
    scheduleEmit()
  }, [currentQuarter, setHomeQSImmediate, setAwayQSImmediate, applyPlusMinus, scheduleEmit])

  const addTF = useCallback((side) => {
    setTeamFouls(tf => {
      const q = quarterRef.current
      const u = { ...tf, [side]: { ...tf[side], [q]: (tf[side][q]||0)+1 } }
      tfRef.current = u; return u
    })
    scheduleEmit()
  }, [scheduleEmit])

  const subTF = useCallback((side) => {
    setTeamFouls(tf => {
      const q = quarterRef.current
      const u = { ...tf, [side]: { ...tf[side], [q]: Math.max(0,(tf[side][q]||0)-1) } }
      tfRef.current = u; return u
    })
    scheduleEmit()
  }, [scheduleEmit])

  // ── Quarter change ─────────────────────────────────────
  const changeQuarter = useCallback((q) => {
    setCurrentQ(q)
    quarterRef.current = q
    setClockSecs(QUARTER_DURATION)
    setRunning(false)
    addToast(`Q${q===5?'OT':q} — team fouls reset to 0`, 'info')
    scheduleEmit()
  }, [scheduleEmit])

  // ── Toggle on-court ────────────────────────────────────
  const toggleCourt = useCallback((side, pid) => {
    const setter = side === 'home' ? setHomeStats : setAwayStats

    setter(prev => {
      const wasOn = prev[pid]?.onCourt || false
      const next  = { ...prev, [pid]: { ...prev[pid], onCourt: !wasOn } }

      if (!wasOn) {
        // Entering court: record current score as baseline
        pmEntryRef.current[pid] = {
          homeScore: sumQS(homeQSRef.current),
          awayScore: sumQS(awayQSRef.current),
        }
      } else {
        // Leaving court: freeze current +/- into stat
        const pm = computePM(pid, side, homeQSRef.current, awayQSRef.current)
        next[pid] = { ...next[pid], plusMinus: pm }
      }

      // Update ref synchronously
      if (side === 'home') homeStatsRef.current = next
      else                 awayStatsRef.current = next

      persistCourt(
        side === 'home' ? next : homeStatsRef.current,
        side === 'away' ? next : awayStatsRef.current,
      )
      return next
    })
    scheduleEmit()
  }, [computePM, persistCourt, scheduleEmit])

  // ── Drag & drop swap ───────────────────────────────────
  const handleDragStart = (pid, side) => { setDragPid(pid); setDragSide(side) }
  const handleDragOver  = (e, pid)     => { e.preventDefault(); setDragOver(pid) }
  const handleDragEnd   = ()           => { setDragPid(null); setDragSide(null); setDragOver(null) }

  const handleDropOnPlayer = useCallback((e, targetPid, side) => {
    e.preventDefault()
    if (!dragPid || dragSide !== side || dragPid === targetPid) { handleDragEnd(); return }
    const setter = side === 'home' ? setHomeStats : setAwayStats
    setter(prev => {
      const next = {
        ...prev,
        [dragPid]:   { ...prev[dragPid],   onCourt: prev[targetPid]?.onCourt },
        [targetPid]: { ...prev[targetPid], onCourt: prev[dragPid]?.onCourt   },
      }
      if (side === 'home') homeStatsRef.current = next
      else                 awayStatsRef.current = next
      persistCourt(
        side === 'home' ? next : homeStatsRef.current,
        side === 'away' ? next : awayStatsRef.current,
      )
      return next
    })
    handleDragEnd()
    scheduleEmit()
  }, [dragPid, dragSide, persistCourt, scheduleEmit])

  const handleDropZone = useCallback((e, zone, side) => {
    e.preventDefault()
    if (!dragPid || dragSide !== side) { handleDragEnd(); return }
    const setter = side === 'home' ? setHomeStats : setAwayStats
    setter(prev => {
      const next = { ...prev, [dragPid]: { ...prev[dragPid], onCourt: zone === 'court' } }
      if (side === 'home') homeStatsRef.current = next
      else                 awayStatsRef.current = next
      persistCourt(
        side === 'home' ? next : homeStatsRef.current,
        side === 'away' ? next : awayStatsRef.current,
      )
      return next
    })
    handleDragEnd()
    scheduleEmit()
  }, [dragPid, dragSide, persistCourt, scheduleEmit])

  // ── Finalize ───────────────────────────────────────────
  const finalizeGame = useCallback(async () => {
    setShowConfirm(false)
    try {
      const markDNP = (map) => {
        const next = { ...map }
        Object.keys(next).forEach(pid => {
          if ((next[pid]._secondsPlayed || 0) === 0) next[pid] = { ...next[pid], didNotPlay: true }
        })
        return next
      }
      const fh = markDNP(homeStatsRef.current)
      const fa = markDNP(awayStatsRef.current)
      const hq = homeQSRef.current
      const aq = awayQSRef.current

      await updateGame(gameId, {
        status: 'final',
        homeScore: sumQS(hq), awayScore: sumQS(aq),
        homeQuarterScores: hq, awayQuarterScores: aq,
        gameClock: '00:00',
      })
      await bulkUpsertStats(gameId, [...Object.values(fh), ...Object.values(fa)].map(toApiStat))
      try { localStorage.removeItem(STORAGE_KEY(gameId)) } catch { }
      socketRef.current?.emit('scoreboardUpdate', { game: { status: 'final' } })
      addToast('Game finalized! 🏆', 'success')
      navigate('/games')
    } catch { addToast('Failed to finalize', 'error') }
  }, [gameId, navigate])

  // ── Derived ────────────────────────────────────────────
  const homeTotal = sumQS(homeQS)
  const awayTotal = sumQS(awayQS)
  const homeFouls = teamFouls.home[currentQuarter] || 0
  const awayFouls = teamFouls.away[currentQuarter] || 0
  const qLabel    = ['1ST','2ND','3RD','4TH','OT'][currentQuarter-1] || `Q${currentQuarter}`

  const currentStats = activeTeam === 'home' ? homeStats  : awayStats
  const currentPList = activeTeam === 'home' ? homePlayers : awayPlayers
  const currentSide  = activeTeam

  const onCourt = currentPList.filter(p =>  currentStats[p._id]?.onCourt && !currentStats[p._id]?.didNotPlay)
  const bench   = currentPList.filter(p => !currentStats[p._id]?.onCourt && !currentStats[p._id]?.didNotPlay)

  const awayOnCount = awayPlayers.filter(p => awayStats[p._id]?.onCourt).length
  const homeOnCount = homePlayers.filter(p => homeStats[p._id]?.onCourt).length

  if (loading) return (
    <div style={{ padding: 32 }}>
      <div className="skeleton" style={{ height: 160, borderRadius: 12, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 420, borderRadius: 12 }} />
    </div>
  )
  if (!game) return (
    <div style={{ padding: 40 }}>
      <p style={{ color: 'var(--red)' }}>Game not found.</p>
      <Link to="/games" style={{ color: 'var(--gold)' }}>← Back</Link>
    </div>
  )

  return (
    <div className="scorer-root">
      {showConfirm && (
        <ConfirmModal
          title="Finalize Game?"
          message="This permanently locks the game. Players with 0 minutes will be marked DNP. This cannot be undone."
          onConfirm={finalizeGame}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* ── Top bar ─────────────────────────────────── */}
      <div className="scorer-topbar">
        <div className="scorer-topbar__left">
          <Link to="/games" className="scorer-topbar__back">← Back</Link>
          <span className="scorer-topbar__title">
            {game.awayTeam?.abbreviation}
            <span className="scorer-topbar__vs"> @ </span>
            {game.homeTeam?.abbreviation}
          </span>
          <span className="badge badge-live"><span className="live-dot" />LIVE · {qLabel}</span>
          <span className="scorer-topbar__autosave">● Auto-saving</span>
        </div>
        <button onClick={() => setShowConfirm(true)} className="btn btn-green btn-sm">✓ Finalize Game</button>
      </div>

      {/* ── Scoreboard ──────────────────────────────── */}
      <div className="scorer-board">
        {/* Away */}
        <div className="scorer-board__team scorer-board__team--away">
          <div className="scorer-board__label">AWAY · {game.awayTeam?.abbreviation}</div>
          <div className="scorer-board__score-row">
            <span className={`scorer-board__score${awayTotal > homeTotal ? ' scorer-board__score--leading' : ''}`}>{awayTotal}</span>
            <div className="scorer-board__controls">
              <div className="scorer-board__pts-btns">
                <button className="sc-btn sc-btn--red" onClick={() => subQPts('away')}>−1</button>
                {[1,2,3].map(n => <button key={n} className="sc-btn" onClick={() => addQPts('away', n)}>+{n}</button>)}
              </div>
              <div className="scorer-board__fouls-row">
                <span className="scorer-board__fouls-label">FOULS Q{currentQuarter}:</span>
                <button className="sc-foul-btn" onClick={() => subTF('away')}>−</button>
                <span className={`scorer-board__foul-count${awayFouls>=5?' scorer-board__foul-count--bonus':''}`}>{awayFouls}</span>
                <button className="sc-foul-btn" onClick={() => addTF('away')}>+</button>
                {awayFouls>=5 && <span className="scorer-board__bonus-tag">BONUS</span>}
              </div>
            </div>
          </div>
          <div className="scorer-board__qscores">
            {['q1','q2','q3','q4','ot'].map((q,i) => (
              <div key={q} className="scorer-board__qscore">
                <div className="scorer-board__qscore-label">{q.toUpperCase()}</div>
                <div className={`scorer-board__qscore-val${i+1===currentQuarter?' scorer-board__qscore-val--active':''}`}>{awayQS[q]||0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Clock */}
        <div className="scorer-clock">
          <button
            className={`scorer-clock__btn${running?' scorer-clock__btn--running':clockSecs===0?' scorer-clock__btn--ended':''}`}
            onClick={() => setRunning(r => !r)}
            title="Click or press SPACEBAR"
          >{fmtClock(clockSecs)}</button>
          <div className="scorer-clock__hint">{running ? '▶ SPACE TO PAUSE' : '⏸ SPACE TO START'}</div>
          <div className="scorer-clock__quarters">
            {[1,2,3,4,5].map(q => (
              <button key={q} className={`scorer-clock__q${currentQuarter===q?' scorer-clock__q--active':''}`} onClick={() => changeQuarter(q)}>
                {q===5?'OT':`Q${q}`}
              </button>
            ))}
          </div>
          <button className="scorer-clock__reset" onClick={() => { setRunning(false); setClockSecs(QUARTER_DURATION) }}>↺ Reset Clock</button>
        </div>

        {/* Home */}
        <div className="scorer-board__team scorer-board__team--home">
          <div className="scorer-board__label">HOME · {game.homeTeam?.abbreviation}</div>
          <div className="scorer-board__score-row scorer-board__score-row--right">
            <div className="scorer-board__controls">
              <div className="scorer-board__pts-btns">
                {[1,2,3].map(n => <button key={n} className="sc-btn" onClick={() => addQPts('home', n)}>+{n}</button>)}
                <button className="sc-btn sc-btn--red" onClick={() => subQPts('home')}>−1</button>
              </div>
              <div className="scorer-board__fouls-row scorer-board__fouls-row--right">
                {homeFouls>=5 && <span className="scorer-board__bonus-tag">BONUS</span>}
                <button className="sc-foul-btn" onClick={() => subTF('home')}>−</button>
                <span className={`scorer-board__foul-count${homeFouls>=5?' scorer-board__foul-count--bonus':''}`}>{homeFouls}</span>
                <button className="sc-foul-btn" onClick={() => addTF('home')}>+</button>
                <span className="scorer-board__fouls-label">FOULS Q{currentQuarter}</span>
              </div>
            </div>
            <span className={`scorer-board__score${homeTotal>awayTotal?' scorer-board__score--leading':''}`}>{homeTotal}</span>
          </div>
          <div className="scorer-board__qscores scorer-board__qscores--right">
            {['q1','q2','q3','q4','ot'].map((q,i) => (
              <div key={q} className="scorer-board__qscore">
                <div className="scorer-board__qscore-label">{q.toUpperCase()}</div>
                <div className={`scorer-board__qscore-val${i+1===currentQuarter?' scorer-board__qscore-val--active':''}`}>{homeQS[q]||0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────── */}
      <div className="scorer-body">
        {/* Team tabs */}
        <div className="scorer-tabs">
          {[
            { key:'away', team:game.awayTeam, count:awayOnCount },
            { key:'home', team:game.homeTeam, count:homeOnCount },
          ].map(({ key, team:t, count }) => (
            <button key={key} className={`scorer-tab${activeTeam===key?' scorer-tab--active':''}`} onClick={() => setActiveTeam(key)}>
              {t?.abbreviation} · {key==='home'?'Home':'Away'}
              <span className={`scorer-tab__count${activeTeam===key&&count>0?' scorer-tab__count--active':''}`}>{count}/5</span>
            </button>
          ))}
        </div>

        <div className="scorer-split">
          {/* Roster panel */}
          <div className="roster-panel">
            {/* On Court */}
            <div className="roster-zone roster-zone--court" onDragOver={e=>e.preventDefault()} onDrop={e=>handleDropZone(e,'court',currentSide)}>
              <div className="roster-zone__label roster-zone__label--court">
                <span className="roster-zone__dot"/>ON COURT ({onCourt.length}/5)
              </div>
              {onCourt.map(p => {
                const s = currentStats[p._id]; const sp = s?._secondsPlayed||0
                return (
                  <div key={p._id} draggable
                    onDragStart={() => handleDragStart(p._id, currentSide)}
                    onDragOver={e => handleDragOver(e, p._id)}
                    onDrop={e => handleDropOnPlayer(e, p._id, currentSide)}
                    onDragEnd={handleDragEnd}
                    onClick={() => toggleCourt(currentSide, p._id)}
                    className={`roster-card roster-card--court${dragOver===p._id?' roster-card--drag-over':''}`}
                  >
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
            <div className="roster-zone roster-zone--bench" onDragOver={e=>e.preventDefault()} onDrop={e=>handleDropZone(e,'bench',currentSide)}>
              <div className="roster-zone__label">BENCH ({bench.length})</div>
              {bench.map(p => {
                const s = currentStats[p._id]
                return (
                  <div key={p._id} draggable
                    onDragStart={() => handleDragStart(p._id, currentSide)}
                    onDragOver={e => handleDragOver(e, p._id)}
                    onDrop={e => handleDropOnPlayer(e, p._id, currentSide)}
                    onDragEnd={handleDragEnd}
                    onClick={() => toggleCourt(currentSide, p._id)}
                    className={`roster-card${dragOver===p._id?' roster-card--drag-over':''}`}
                  >
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
                  {COLS.map(c => (
                    <th key={c.key} className={c.key==='points'?'col-pts':c.pf?'col-pf':c.makes?'col-makes':''}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {onCourt.length > 0 && (
                  <tr className="section-header section-header--court">
                    <td colSpan={COLS.length + 1}>⬤ On Court</td>
                  </tr>
                )}
                {onCourt.map(player => renderRow(player, currentStats, currentSide, game, true, incStat, decStat, COLS))}

                {bench.length > 0 && (
                  <tr className="section-header section-header--bench">
                    <td colSpan={COLS.length + 1}>— Bench</td>
                  </tr>
                )}
                {bench.map(player => renderRow(player, currentStats, currentSide, game, false, incStat, decStat, COLS))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Row renderer (outside component — no hooks) ─────────
function renderRow(player, currentStats, currentSide, game, isOnCourt, incStat, decStat, COLS) {
  const s  = currentStats[player._id] || mkBlank(player, game[`${currentSide}Team`]?._id, isOnCourt)
  const sp = s._secondsPlayed || 0
  const pm = s.plusMinus || 0
  const pmClass = pm > 0 ? 'cell-pm cell-pm--pos' : pm < 0 ? 'cell-pm cell-pm--neg' : 'cell-pm cell-pm--zero'

  return (
    <tr key={player._id} className={isOnCourt ? 'row--on-court' : 'row--bench'}>
      <td>
        <div className="player-cell">
          <div className="player-num-circle" style={{ width:30, height:30, fontSize:'0.85rem' }}>
            {player.jerseyNumber}
          </div>
          <div className="player-cell__info">
            <span className="player-cell__name">{player.firstName} {player.lastName}</span>
            <span className="player-cell__badge">{player.position}</span>
          </div>
          {isOnCourt && <span className="player-cell__dot" />}
        </div>
      </td>
      {COLS.map(col => {
        if (col.key === 'points') return (
          <td key={col.key}><span className="cell-pts">{s.points || 0}</span></td>
        )
        if (col.key === 'totalRebounds') return (
          <td key={col.key}><span className="cell-reb">{s.totalRebounds || 0}</span></td>
        )
        if (col.key === 'minutesPlayed') return (
          <td key={col.key}>
            <span className={`cell-min${isOnCourt ? ' cell-min--oncourt' : ''}`}>
              {Math.floor(sp/60)}:{String(Math.round(sp%60)).padStart(2,'0')}
            </span>
          </td>
        )
        if (col.key === 'plusMinus') return (
          <td key={col.key}><span className={pmClass}>{pm > 0 ? `+${pm}` : pm}</span></td>
        )

        const val = s[col.key] ?? 0
        let valClass = 'stat-cell__val'
        if (col.pf && val >= 5) valClass += ' stat-cell__val--red'

        let incClass = 'stat-cell__inc'
        if (col.pf)    incClass += ' stat-cell__inc--pf'
        else if (col.makes) incClass += ' stat-cell__inc--makes'

        return (
          <td key={col.key}>
            <div className="stat-cell">
              <button className="stat-cell__dec" onClick={() => isOnCourt && decStat(currentSide, player._id, col.key)}>−</button>
              <span className={valClass}>{val}</span>
              <button className={incClass} onClick={() => isOnCourt && incStat(currentSide, player._id, col.key)}>+</button>
            </div>
          </td>
        )
      })}
    </tr>
  )
}