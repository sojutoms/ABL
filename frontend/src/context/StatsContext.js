import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getLiveGames, getLeagueOverview } from '../services/api';

const StatsContext = createContext();

const initialState = {
  liveGames: [],
  recentGames: [],
  upcomingGames: [],
  teams: [],
  loading: false,
  error: null,
  socket: null,
  connected: false,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_OVERVIEW':
      return {
        ...state,
        liveGames: action.payload.liveGames,
        recentGames: action.payload.recentGames,
        upcomingGames: action.payload.upcomingGames,
        teams: action.payload.teams,
        loading: false,
      };
    case 'SET_LIVE_GAMES':
      return { ...state, liveGames: action.payload };
    case 'GAME_UPDATE': {
      const updatedGame = action.payload.game;
      const updateList = (list) =>
        list.map((g) => (g._id === updatedGame._id ? updatedGame : g));
      return {
        ...state,
        liveGames: updatedGame.status === 'final'
          ? state.liveGames.filter((g) => g._id !== updatedGame._id)
          : updateList(state.liveGames),
        recentGames: updatedGame.status === 'final'
          ? [updatedGame, ...state.recentGames.filter((g) => g._id !== updatedGame._id)].slice(0, 5)
          : state.recentGames,
      };
    }
    case 'SET_SOCKET':
      return { ...state, socket: action.payload };
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };
    default:
      return state;
  }
};

export const StatsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Fetch league overview
  const fetchOverview = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await getLeagueOverview();
      dispatch({ type: 'SET_OVERVIEW', payload: data.data });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, []);

  // Refresh live games only
  const refreshLiveGames = useCallback(async () => {
    try {
      const { data } = await getLiveGames();
      dispatch({ type: 'SET_LIVE_GAMES', payload: data.data });
    } catch (err) {
      console.error('Failed to refresh live games', err);
    }
  }, []);

  // Socket.io setup
  useEffect(() => {
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, { transports: ['websocket'], reconnectionAttempts: 5 });

    socket.on('connect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: true });
    });

    socket.on('disconnect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    // Listen for game score/clock updates
    socket.on('scoreboardUpdate', ({ game }) => {
      dispatch({ type: 'GAME_UPDATE', payload: { game } });
    });

    dispatch({ type: 'SET_SOCKET', payload: socket });

    return () => socket.disconnect();
  }, []);

  // Initial data load
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <StatsContext.Provider
      value={{ ...state, fetchOverview, refreshLiveGames, dispatch }}
    >
      {children}
    </StatsContext.Provider>
  );
};

export const useStats = () => {
  const context = useContext(StatsContext);
  if (!context) throw new Error('useStats must be used within StatsProvider');
  return context;
};