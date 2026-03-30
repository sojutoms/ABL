import React, { useEffect, useState } from 'react';
import { getLeagueLeaders, getSeasonStats } from '../services/api';
import './Stats.css';

const LEADER_CATEGORIES = [
  { key: 'avgPoints', label: 'Points', unit: 'PPG' },
  { key: 'avgRebounds', label: 'Rebounds', unit: 'RPG' },
  { key: 'avgAssists', label: 'Assists', unit: 'APG' },
  { key: 'avgSteals', label: 'Steals', unit: 'SPG' },
  { key: 'avgBlocks', label: 'Blocks', unit: 'BPG' },
  { key: 'fgPct', label: 'FG%', unit: '%', isPct: true },
  { key: 'threePtPct', label: '3P%', unit: '%', isPct: true },
  { key: 'ftPct', label: 'FT%', unit: '%', isPct: true },
];

const SEASON_COLS = [
  { key: 'name', label: 'PLAYER', align: 'left' },
  { key: 'team', label: 'TEAM', align: 'left' },
  { key: 'gamesPlayed', label: 'GP' },
  { key: 'avgMinutes', label: 'MIN' },
  { key: 'avgPoints', label: 'PTS', highlight: true },
  { key: 'avgRebounds', label: 'REB' },
  { key: 'avgAssists', label: 'AST' },
  { key: 'avgSteals', label: 'STL' },
  { key: 'avgBlocks', label: 'BLK' },
  { key: 'avgTurnovers', label: 'TO' },
  { key: 'fgPct', label: 'FG%', isPct: true },
  { key: 'threePtPct', label: '3P%', isPct: true },
  { key: 'ftPct', label: 'FT%', isPct: true },
];

const fmtPct = (v) => v ? (v * 100).toFixed(1) : '0.0';
// const fmtVal = (v, isPct) => isPct ? fmtPct(v) + '%' : (v?.toFixed ? v.toFixed(1) : v ?? '-');

const LeaderCard = ({ cat, leaders }) => {
  const top = leaders?.[0];
  if (!top) return null;

  return (
    <div className="leader-card">
      <div className="leader-card__header">
        <span className="leader-card__unit">{cat.unit}</span>
        <span className="leader-card__label">{cat.label}</span>
      </div>
      <div className="leader-card__top">
        <div className="leader-card__avatar">
          {top.player?.photo
            ? <img src={top.player.photo} alt={top.player.fullName} />
            : <span>{top.player?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>}
        </div>
        <div className="leader-card__info">
          <span className="leader-card__name">{top.player?.fullName}</span>
          <span className="leader-card__team">{top.team?.abbreviation}</span>
        </div>
        <div className="leader-card__value">
          {cat.isPct ? fmtPct(top.value) + '%' : top.value}
        </div>
      </div>
      {/* Top 3 runners-up */}
      <div className="leader-card__list">
        {leaders.slice(1, 4).map((p, i) => (
          <div key={i} className="leader-card__row">
            <span className="leader-card__rank">{i + 2}</span>
            <span className="leader-card__row-name">{p.player?.fullName}</span>
            <span className="leader-card__row-team muted">{p.team?.abbreviation}</span>
            <span className="leader-card__row-val">
              {cat.isPct ? fmtPct(p.value) + '%' : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Stats = () => {
  const [leaders, setLeaders] = useState({});
  const [seasonStats, setSeasonStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('avgPoints');
  const [sortDir, setSortDir] = useState('desc');
  const [tab, setTab] = useState('leaders');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [leadRes, seasonRes] = await Promise.all([
          getLeagueLeaders(),
          getSeasonStats(),
        ]);
        setLeaders(leadRes.data.data);
        setSeasonStats(seasonRes.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedStats = [...seasonStats].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  return (
    <div className="page page-enter">
      <div className="container">
        <div className="stats-header">
          <h1 className="section-title">Stats</h1>
        </div>

        {/* Tabs */}
        <div className="stats-tabs">
          <button
            className={`stats-tab${tab === 'leaders' ? ' stats-tab--active' : ''}`}
            onClick={() => setTab('leaders')}
          >
            League Leaders
          </button>
          <button
            className={`stats-tab${tab === 'all' ? ' stats-tab--active' : ''}`}
            onClick={() => setTab('all')}
          >
            Player Stats
          </button>
        </div>

        {/* ─── League Leaders ──────────────────────────────── */}
        {tab === 'leaders' && (
          <div className="leaders-grid">
            {loading
              ? [1, 2, 3, 4, 5, 6].map((k) => (
                  <div key={k} className="leader-card">
                    <div className="skeleton" style={{ height: 160 }} />
                  </div>
                ))
              : LEADER_CATEGORIES.map((cat) => (
                  <LeaderCard key={cat.key} cat={cat} leaders={leaders[cat.key]} />
                ))}
          </div>
        )}

        {/* ─── Full Player Stats Table ──────────────────────── */}
        {tab === 'all' && (
          <div className="stats-table-wrap card">
            {loading ? (
              <div className="skeleton" style={{ height: 300 }} />
            ) : seasonStats.length === 0 ? (
              <p className="muted" style={{ padding: 40, textAlign: 'center' }}>No stats yet for this season.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="abl-table">
                  <thead>
                    <tr>
                      {SEASON_COLS.map((col) => (
                        <th
                          key={col.key}
                          style={{ textAlign: col.align || 'right' }}
                          className={sortKey === col.key ? 'sort-active' : ''}
                          onClick={() => !['name', 'team'].includes(col.key) && handleSort(col.key)}
                        >
                          {col.label}
                          {sortKey === col.key && (
                            <span style={{ marginLeft: 4, fontSize: '0.6rem' }}>
                              {sortDir === 'desc' ? '▼' : '▲'}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStats.map((row, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: 'left' }}>
                          <span style={{ fontWeight: 500 }}>
                            {row.playerInfo?.firstName} {row.playerInfo?.lastName}
                          </span>
                          <span className="muted small" style={{ marginLeft: 6 }}>
                            #{row.playerInfo?.jerseyNumber}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          <span className="muted small">{row.teamInfo?.abbreviation || '—'}</span>
                        </td>
                        <td>{row.gamesPlayed}</td>
                        <td>{row.avgMinutes}</td>
                        <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--white)' }}>
                          {row.avgPoints}
                        </td>
                        <td>{row.avgRebounds}</td>
                        <td>{row.avgAssists}</td>
                        <td>{row.avgSteals}</td>
                        <td>{row.avgBlocks}</td>
                        <td>{row.avgTurnovers}</td>
                        <td>{fmtPct(row.fgPct)}%</td>
                        <td>{fmtPct(row.threePtPct)}%</td>
                        <td>{fmtPct(row.ftPct)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;