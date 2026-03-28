import React, { useEffect, useState } from 'react';
import { getStandings } from '../services/api';
import './Teams.css';

const Teams = () => {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const { data } = await getStandings();
        setStandings(data.data);
      } catch (err) {
        setError('Failed to load standings.');
      } finally {
        setLoading(false);
      }
    };
    fetchStandings();
  }, []);

  return (
    <div className="page page-enter">
      <div className="container">
        <div className="teams-header">
          <h1 className="section-title">Teams &amp; Standings</h1>
          <p className="muted" style={{ marginTop: 6 }}>2025 ABL Season</p>
        </div>

        {error && <p style={{ color: 'var(--live-red)', padding: '20px 0' }}>{error}</p>}

        {/* Standings Table */}
        <div className="teams-table-wrap card">
          {loading ? (
            <div style={{ padding: 24 }}>
              {[1, 2, 3, 4].map((k) => (
                <div key={k} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />
              ))}
            </div>
          ) : standings.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🏀</p>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--white-60)', marginBottom: 8 }}>
                No Teams Yet
              </h3>
              <p className="muted">Teams will appear here once added to the league.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="abl-table standings-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>#</th>
                    <th style={{ textAlign: 'left', minWidth: 200 }}>TEAM</th>
                    <th>GP</th>
                    <th>W</th>
                    <th>L</th>
                    <th>PCT</th>
                    <th>GB</th>
                    <th>HOME</th>
                    <th>AWAY</th>
                    <th>PPG</th>
                    <th>OPP PPG</th>
                    <th>DIFF</th>
                    <th>STK</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((team, i) => {
                    const diff = team.ppg - team.oppPpg;
                    const isLeader = i === 0;

                    return (
                      <tr key={team._id} className={isLeader ? 'standings-leader' : ''}>
                        <td style={{ textAlign: 'center' }}>
                          {isLeader ? (
                            <span className="rank-star">★</span>
                          ) : (
                            <span className="muted small">{i + 1}</span>
                          )}
                        </td>
                        <td>
                          <div className="team-cell">
                            {team.logo ? (
                              <img src={team.logo} alt={team.abbreviation} className="team-cell__logo" />
                            ) : (
                              <div
                                className="team-cell__dot"
                                style={{ background: team.primaryColor || '#555' }}
                              />
                            )}
                            <div className="team-cell__names">
                              <span className="team-cell__name">{team.name}</span>
                              <span className="team-cell__abbr muted small">{team.abbreviation}</span>
                            </div>
                          </div>
                        </td>
                        <td className="muted">{team.gamesPlayed}</td>
                        <td style={{ color: 'var(--white)', fontWeight: 600 }}>{team.wins}</td>
                        <td>{team.losses}</td>
                        <td>{team.winPct?.toFixed(3) || '.000'}</td>
                        <td className={isLeader ? 'gold' : 'muted'}>{team.gamesBehind}</td>
                        <td className="muted small">{team.homeRecord}</td>
                        <td className="muted small">{team.awayRecord}</td>
                        <td>{team.ppg}</td>
                        <td className="muted">{team.oppPpg}</td>
                        <td className={diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : 'muted'}>
                          {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                        </td>
                        <td>
                          <span className={`streak-badge ${team.streak?.startsWith('W') ? 'w' : 'l'}`}>
                            {team.streak || 'W0'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Team Cards */}
        {!loading && standings.length > 0 && (
          <div className="teams-cards">
            <h2 className="section-title" style={{ marginBottom: 20 }}>Teams</h2>
            <div className="teams-grid">
              {standings.map((team) => (
                <div key={team._id} className="team-card">
                  <div
                    className="team-card__banner"
                    style={{ background: `linear-gradient(135deg, ${team.primaryColor || '#1a1a1a'} 0%, ${team.secondaryColor || '#2a2a2a'} 100%)` }}
                  />
                  <div className="team-card__body">
                    {team.logo ? (
                      <img src={team.logo} alt={team.name} className="team-card__logo" />
                    ) : (
                      <div className="team-card__logo-placeholder" style={{ background: team.primaryColor || '#333' }}>
                        {team.abbreviation}
                      </div>
                    )}
                    <div className="team-card__info">
                      <span className="team-card__city muted small">{team.city}</span>
                      <h3 className="team-card__name">{team.name}</h3>
                      <span className="team-card__abbr">{team.abbreviation}</span>
                    </div>
                    <div className="team-card__record">
                      <div className="team-card__stat">
                        <span className="team-card__stat-val">{team.wins}</span>
                        <span className="team-card__stat-label">W</span>
                      </div>
                      <span className="muted">—</span>
                      <div className="team-card__stat">
                        <span className="team-card__stat-val">{team.losses}</span>
                        <span className="team-card__stat-label">L</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Teams;