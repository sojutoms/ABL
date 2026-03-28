import React from 'react';
import { Link } from 'react-router-dom';
import { useStats } from '../context/StatsContext';
import GameCard from '../components/GameCard';
import './Home.css';

const SkeletonCard = () => (
  <div className="card" style={{ height: 130 }}>
    <div className="skeleton" style={{ width: '40%', height: 18, marginBottom: 16 }} />
    <div className="skeleton" style={{ width: '100%', height: 36, marginBottom: 8 }} />
    <div className="skeleton" style={{ width: '100%', height: 36 }} />
  </div>
);

const Home = () => {
  const { liveGames, recentGames, upcomingGames, teams, loading } = useStats();

  return (
    <div className="page page-enter">
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="home-hero">
        <div className="home-hero__bg" />
        <div className="container home-hero__content">
          <p className="home-hero__eyebrow">
            <span className="live-dot" style={{ display: liveGames.length > 0 ? 'block' : 'none' }} />
            {liveGames.length > 0 ? `${liveGames.length} Game${liveGames.length > 1 ? 's' : ''} Live Now` : '2025 Season'}
          </p>
          <h1 className="home-hero__title">
            ABL <span className="home-hero__title-gold">Basketball</span><br />League
          </h1>
          <p className="home-hero__sub">Official stats, schedules & standings</p>
          <div className="home-hero__actions">
            <Link to="/schedule" className="btn-primary">View Schedule</Link>
            <Link to="/stats" className="btn-secondary">League Leaders</Link>
          </div>
        </div>
        <div className="home-hero__court-lines" />
      </section>

      {/* ─── Live Games ───────────────────────────────────── */}
      {(loading || liveGames.length > 0) && (
        <section className="home-section">
          <div className="container">
            <div className="home-section__header">
              <h2 className="section-title">
                <span className="live-dot" />
                Live Now
              </h2>
              <Link to="/schedule" className="see-all">See All →</Link>
            </div>
            <div className="games-grid">
              {loading
                ? [1, 2].map((k) => <SkeletonCard key={k} />)
                : liveGames.map((game) => <GameCard key={game._id} game={game} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── Recent Results ───────────────────────────────── */}
      {(loading || recentGames.length > 0) && (
        <section className="home-section">
          <div className="container">
            <div className="home-section__header">
              <h2 className="section-title">Recent Results</h2>
              <Link to="/schedule" className="see-all">See All →</Link>
            </div>
            <div className="games-grid">
              {loading
                ? [1, 2, 3].map((k) => <SkeletonCard key={k} />)
                : recentGames.map((game) => <GameCard key={game._id} game={game} compact />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── Upcoming ─────────────────────────────────────── */}
      {(loading || upcomingGames.length > 0) && (
        <section className="home-section">
          <div className="container">
            <div className="home-section__header">
              <h2 className="section-title">Upcoming Games</h2>
              <Link to="/schedule" className="see-all">See All →</Link>
            </div>
            <div className="games-grid">
              {loading
                ? [1, 2].map((k) => <SkeletonCard key={k} />)
                : upcomingGames.map((game) => <GameCard key={game._id} game={game} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─── Quick Standings ──────────────────────────────── */}
      {(loading || teams.length > 0) && (
        <section className="home-section home-section--last">
          <div className="container">
            <div className="home-section__header">
              <h2 className="section-title">Standings</h2>
              <Link to="/teams" className="see-all">Full Standings →</Link>
            </div>
            <div className="card">
              <table className="abl-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>TEAM</th>
                    <th>W</th>
                    <th>L</th>
                    <th>PCT</th>
                    <th>GB</th>
                    <th>STK</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? [1, 2, 3, 4].map((k) => (
                        <tr key={k}>
                          {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                            <td key={j}><div className="skeleton" style={{ height: 14, width: j === 2 ? 100 : 30 }} /></td>
                          ))}
                        </tr>
                      ))
                    : teams.map((team, i) => (
                        <tr key={team._id}>
                          <td className="muted small">{i + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                className="team-dot"
                                style={{ background: team.primaryColor || '#666' }}
                              />
                              <span style={{ fontWeight: 500 }}>{team.name}</span>
                              <span className="muted small">({team.abbreviation})</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--white)' }}>{team.wins}</td>
                          <td>{team.losses}</td>
                          <td>{((team.wins + team.losses) > 0
                            ? (team.wins / (team.wins + team.losses)).toFixed(3)
                            : '.000')}</td>
                          <td className="muted">{team.gamesBehind || '-'}</td>
                          <td>
                            <span className={`streak-badge ${team.streak?.startsWith('W') ? 'w' : 'l'}`}>
                              {team.streak || 'W0'}
                            </span>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && liveGames.length === 0 && recentGames.length === 0 && upcomingGames.length === 0 && teams.length === 0 && (
        <div className="container" style={{ paddingTop: 80, textAlign: 'center' }}>
          <p style={{ fontSize: '4rem' }}>🏀</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 8 }}>Season Loading</h2>
          <p className="muted">Games and standings will appear here once the season begins.</p>
        </div>
      )}
    </div>
  );
};

export default Home;