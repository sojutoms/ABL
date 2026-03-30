import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
})

// ─── Teams ───────────────────────────────────────────────
export const getTeams      = ()       => API.get('/teams')
export const createTeam    = (data)   => API.post('/teams', data)
export const updateTeam    = (id, d)  => API.put(`/teams/${id}`, d)

// ─── Players ─────────────────────────────────────────────
export const getPlayers    = (teamId) => API.get('/players', { params: teamId ? { team: teamId } : {} })
export const getPlayerById = (id)     => API.get(`/players/${id}`)
export const createPlayer  = (data)   => API.post('/players', data)
export const updatePlayer  = (id, d)  => API.put(`/players/${id}`, d)
export const deletePlayer  = (id)     => API.delete(`/players/${id}`)

// ─── Games ───────────────────────────────────────────────
export const getGames      = (params) => API.get('/games', { params })
export const getGameById   = (id)     => API.get(`/games/${id}`)
export const createGame    = (data)   => API.post('/games', data)
export const updateGame    = (id, d)  => API.put(`/games/${id}`, d)
export const deleteGame    = (id)     => API.delete(`/games/${id}`)

// ─── Stats ───────────────────────────────────────────────
export const getGameStats      = (gameId) => API.get(`/stats/game/${gameId}`)
export const createStats       = (data)   => API.post('/stats', data)
export const updateStats       = (id, d)  => API.put(`/stats/${id}`, d)
export const bulkUpsertStats   = (gameId, statsArray) => API.post('/stats/bulk', { gameId, statsArray })

export default API