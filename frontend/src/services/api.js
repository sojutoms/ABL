import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 10000,
});

// ─── Teams ───────────────────────────────────────────────
export const getTeams = () => API.get('/teams');
export const getTeamById = (id) => API.get(`/teams/${id}`);
export const getStandings = () => API.get('/teams/standings');

// ─── Players ─────────────────────────────────────────────
export const getPlayers = (teamId) =>
  API.get('/players', { params: teamId ? { team: teamId } : {} });
export const getPlayerById = (id) => API.get(`/players/${id}`);

// ─── Games ───────────────────────────────────────────────
export const getGames = (params) => API.get('/games', { params });
export const getGameById = (id) => API.get(`/games/${id}`);
export const getLiveGames = () => API.get('/games/live');

// ─── Stats ───────────────────────────────────────────────
export const getGameStats = (gameId) => API.get(`/stats/game/${gameId}`);
export const getPlayerStats = (playerId) => API.get(`/stats/player/${playerId}`);
export const getLeagueLeaders = (minGames = 1) =>
  API.get('/stats/leaders', { params: { minGames } });
export const getSeasonStats = () => API.get('/stats/season');

// ─── League ──────────────────────────────────────────────
export const getLeagueOverview = () => API.get('/league/overview');

export default API;