import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGameById, getGameStats } from '../services/api';
import { useStats } from '../context/StatsContext';
import BoxScore from '../components/BoxScore';
import './GameDetail.css';

const quarterLabel = (q, isOT) => {
  if (isOT) return 'OT';
  return ['1ST', '2ND', '3RD', '4TH'][q - 1] || `Q${q}`;
};

const QuarterScores = ({ home, away, current, isFinal }) => {
  const quarters = ['q1', 'q2', 'q3', 'q4'];
  const showOT = home?.ot > 0 || away?.ot > 0;

  return (
    <div className="quarter-scores">
      <table className="quarter-table">
        <thead>
          <tr>
            <th>TEAM</th>
            {quarters.map((q, i) => (
              <th key={q} className={!isFinal && current === i + 1 ? 'active-q' : ''}>
                {['1', '2', '3', '4'][i]}
              </th>
            ))}
            {showOT && <th>OT</th>}
            <th className="total-col">T</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'Away', scores: away },
            { label: 'Home', scores: home },
          ].map(({ label, scores }) => (
            <tr key={label}>
              <td className="team-label">{label}</td>
              {quarters.map((q) => (
                <td key={q}>{scores?.[q] || 0}</td>
              ))}
              {showOT && <td>{scores?.ot || 0}</td>}
              <td className="total-col">
                {quarters.reduce((s, q) => s + (scores?.[q] || 0), 0) + (scores?.ot || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const GameDetail = () => {
  const { gameId } = useParams();
  const { socket } = useStats();
  const [game, setGame] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [gameRes, statsRes] = await Promise.all([
        getGameById(gameId),
        getGameStats(gameId),
      ]);
      setGame(gameRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      setError('Failed to load game data.');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket.io: join room and listen for live updates
  useEffect(() => {
    if (!socket || !gameId) return;
    socket.emit('joinGame', gameId);

    socket.on('gameUpdate', ({ game: updatedGame }) => {
      setGame(updatedGame);
    });

    socket.on('statsUpdate', ({ stats: updatedStat }) => {
      setStats((prev) => {
        const idx = prev.findIndex((s) => s._id === updatedStat._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedStat;
          return next;
        }
        return [...prev, updatedStat];
      });
    });

    socket.on('boxScoreUpdate', ({ stats: updatedStats }) => {
      setStats(updatedStats);
    });

    return () => {
      socket.emit('leaveGame', gameId);
      socket.off('gameUpdate');
      socket.off('statsUpdate');
      socket.off('boxScoreUpdate');
    };
  }, [socket, gameId]);

  if (loading) {
    return (
      <div className="page page-enter">
        <div className="container">
          <div className="game-detail-skeleton">
            <div className="skeleton" style={{ height: 180, borderRadius: 16, marginBottom: 24 }} />
            <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="page page-enter">
        <div className="container">
          <p style={{ color: 'var(--live-red)', paddingTop: 40 }}>{error || 'Game not found.'}</p>
          <Link to="/schedule" style={{ color: 'var(--gold)' }}>← Back to Schedule</Link>
        </div>
      </div>
    );
  }

  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const homeWon = isFinal && game.homeScore > game.awayScore;
  const awayWon = isFinal && game.awayScore > game.homeScore;

  return (
    <div className="page page-enter">
      <div className="container">
        {/* Back link */}
        <div className="game-detail-back">
          <Link to="/schedule" className="back-link">← Schedule</Link>
          {game.round && <span className="muted small">{game.round}</span>}
        </div>

        {/* Scoreboard header */}
        <div className={`scoreboard${isLive ? ' scoreboard--live' : ''}`}>
          {isLive && <div className="scoreboard__live-bar" />}

          {/* Status */}
          <div className="scoreboard__status">
            {isLive && (
              <span className="badge badge-live">
                <span className="live-dot" />
                {quarterLabel(game.currentQuarter, game.isOvertime)} — {game.gameClock}
              </span>
            )}
            {isFinal && <span className="badge badge-final">FINAL</span>}
            {game.status === 'scheduled' && (
              <span className="badge badge-scheduled">
                {new Date(game.scheduledDate).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            )}
          </div>

          {/* Teams + Scores */}
          <div className="scoreboard__matchup">
            {/* Away team */}
            <div className={`scoreboard__team${awayWon ? ' scoreboard__team--winner' : ''}`}>
              {game.awayTeam?.logo ? (
                <img src={game.awayTeam.logo} alt={game.awayTeam.abbreviation} className="scoreboard__logo" />
              ) : (
                <div className="scoreboard__logo-placeholder" style={{ background: game.awayTeam?.primaryColor || '#333' }}>
                  {game.awayTeam?.abbreviation}
                </div>
              )}
              <div className="scoreboard__team-name">
                <span className="scoreboard__city">{game.awayTeam?.city}</span>
                <span className="scoreboard__name">{game.awayTeam?.name}</span>
                <span className="scoreboard__record muted small">Away</span>
              </div>
              <div className={`scoreboard__score${isLive ? ' scoreboard__score--live' : ''}`}>
                {game.status !== 'scheduled' ? game.awayScore : '—'}
              </div>
            </div>

            <div className="scoreboard__vs">VS</div>

            {/* Home team */}
            <div className={`scoreboard__team scoreboard__team--home${homeWon ? ' scoreboard__team--winner' : ''}`}>
              <div className={`scoreboard__score${isLive ? ' scoreboard__score--live' : ''}`}>
                {game.status !== 'scheduled' ? game.homeScore : '—'}
              </div>
              <div className="scoreboard__team-name scoreboard__team-name--right">
                <span className="scoreboard__city">{game.homeTeam?.city}</span>
                <span className="scoreboard__name">{game.homeTeam?.name}</span>
                <span className="scoreboard__record muted small">Home</span>
              </div>
              {game.homeTeam?.logo ? (
                <img src={game.homeTeam.logo} alt={game.homeTeam.abbreviation} className="scoreboard__logo" />
              ) : (
                <div className="scoreboard__logo-placeholder" style={{ background: game.homeTeam?.primaryColor || '#333' }}>
                  {game.homeTeam?.abbreviation}
                </div>
              )}
            </div>
          </div>

          {/* Team Fouls + Quarter scores */}
          {game.status !== 'scheduled' && (
            <div className="scoreboard__details">
              <div className="team-fouls">
                <span className="team-fouls__label">Team Fouls</span>
                <div className="team-fouls__counts">
                  <span>{game.awayTeamFouls}</span>
                  <span className="muted">—</span>
                  <span>{game.homeTeamFouls}</span>
                </div>
              </div>
              <QuarterScores
                away={game.awayQuarterScores}
                home={game.homeQuarterScores}
                current={game.currentQuarter}
                isFinal={isFinal}
              />
            </div>
          )}
        </div>

        {/* Box Score */}
        {game.status !== 'scheduled' && (
          <div className="game-detail-boxscore">
            <h2 className="section-title" style={{ marginBottom: 20 }}>Box Score</h2>
            <BoxScore
              stats={stats}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
            />
          </div>
        )}

        {game.status === 'scheduled' && (
          <div className="game-detail-upcoming">
            <p>📅 Game hasn't started yet. Check back when the game is live for box scores.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameDetail;