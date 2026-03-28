import React, { useState } from 'react';
import './BoxScore.css';

const fmtPct = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return (val * 100).toFixed(1) + '%';
};

const fmtNum = (val, fallback = '0') => {
  if (val === undefined || val === null) return fallback;
  return val;
};

const COLUMNS = [
  { key: 'player', label: 'PLAYER', align: 'left', sortable: false },
  { key: 'minutesPlayed', label: 'MIN', align: 'right' },
  { key: 'points', label: 'PTS', align: 'right', highlight: true },
  { key: 'totalRebounds', label: 'REB', align: 'right' },
  { key: 'assists', label: 'AST', align: 'right' },
  { key: 'steals', label: 'STL', align: 'right' },
  { key: 'blocks', label: 'BLK', align: 'right' },
  { key: 'fgSplit', label: 'FG', align: 'right', sortable: false },
  { key: 'fgPct', label: 'FG%', align: 'right' },
  { key: '3pSplit', label: '3P', align: 'right', sortable: false },
  { key: 'threePtPct', label: '3P%', align: 'right' },
  { key: 'ftSplit', label: 'FT', align: 'right', sortable: false },
  { key: 'ftPct', label: 'FT%', align: 'right' },
  { key: 'offRebounds', label: 'OREB', align: 'right' },
  { key: 'defRebounds', label: 'DREB', align: 'right' },
  { key: 'turnovers', label: 'TO', align: 'right' },
  { key: 'personalFouls', label: 'PF', align: 'right' },
  { key: 'plusMinus', label: '+/-', align: 'right' },
];

const StatRow = ({ stat, rank }) => {
  const pm = stat.plusMinus;
  const pmClass = pm > 0 ? 'plus' : pm < 0 ? 'minus' : '';

  return (
    <tr className={stat.didNotPlay ? 'dnp-row' : ''}>
      <td className="player-cell">
        <span className="player-number">#{stat.player?.jerseyNumber}</span>
        <span className="player-name">{stat.player?.firstName} {stat.player?.lastName}</span>
        <span className="player-pos">{stat.player?.position}</span>
        {stat.isStarter && <span className="starter-dot" title="Starter" />}
      </td>
      {stat.didNotPlay ? (
        <td colSpan={COLUMNS.length - 1} className="dnp-cell">DNP</td>
      ) : (
        <>
          <td>{fmtNum(stat.minutesPlayed)}</td>
          <td className="pts-cell">{fmtNum(stat.points)}</td>
          <td>{fmtNum(stat.totalRebounds)}</td>
          <td>{fmtNum(stat.assists)}</td>
          <td>{fmtNum(stat.steals)}</td>
          <td>{fmtNum(stat.blocks)}</td>
          <td className="split-cell">{stat.fgMade}-{stat.fgAttempts}</td>
          <td>{fmtPct(stat.fgPct)}</td>
          <td className="split-cell">{stat.threePtMade}-{stat.threePtAttempts}</td>
          <td>{fmtPct(stat.threePtPct)}</td>
          <td className="split-cell">{stat.ftMade}-{stat.ftAttempts}</td>
          <td>{fmtPct(stat.ftPct)}</td>
          <td>{fmtNum(stat.offRebounds)}</td>
          <td>{fmtNum(stat.defRebounds)}</td>
          <td>{fmtNum(stat.turnovers)}</td>
          <td>{fmtNum(stat.personalFouls)}</td>
          <td className={`pm-cell ${pmClass}`}>
            {pm > 0 ? `+${pm}` : fmtNum(pm)}
          </td>
        </>
      )}
    </tr>
  );
};

const TeamTotals = ({ stats }) => {
  const active = stats.filter((s) => !s.didNotPlay);
  const sum = (key) => active.reduce((acc, s) => acc + (s[key] || 0), 0);
  const fgMade = sum('fgMade'), fgAtt = sum('fgAttempts');
  const tpMade = sum('threePtMade'), tpAtt = sum('threePtAttempts');
  const ftMade = sum('ftMade'), ftAtt = sum('ftAttempts');

  return (
    <tr className="totals-row">
      <td>TOTALS</td>
      <td>—</td>
      <td className="pts-cell">{sum('points')}</td>
      <td>{sum('totalRebounds')}</td>
      <td>{sum('assists')}</td>
      <td>{sum('steals')}</td>
      <td>{sum('blocks')}</td>
      <td className="split-cell">{fgMade}-{fgAtt}</td>
      <td>{fgAtt > 0 ? (fgMade / fgAtt * 100).toFixed(1) + '%' : '-'}</td>
      <td className="split-cell">{tpMade}-{tpAtt}</td>
      <td>{tpAtt > 0 ? (tpMade / tpAtt * 100).toFixed(1) + '%' : '-'}</td>
      <td className="split-cell">{ftMade}-{ftAtt}</td>
      <td>{ftAtt > 0 ? (ftMade / ftAtt * 100).toFixed(1) + '%' : '-'}</td>
      <td>{sum('offRebounds')}</td>
      <td>{sum('defRebounds')}</td>
      <td>{sum('turnovers')}</td>
      <td>{sum('personalFouls')}</td>
      <td>—</td>
    </tr>
  );
};

const BoxScore = ({ stats, homeTeam, awayTeam }) => {
  const [activeTab, setActiveTab] = useState('away');

  if (!stats || stats.length === 0) {
    return (
      <div className="boxscore-empty">
        <p>No stats available yet.</p>
      </div>
    );
  }

  const homeStats = stats.filter((s) => s.team?._id === homeTeam?._id || s.team === homeTeam?._id);
  const awayStats = stats.filter((s) => s.team?._id === awayTeam?._id || s.team === awayTeam?._id);
  const activeStats = activeTab === 'home' ? homeStats : awayStats;
  const activeTeam = activeTab === 'home' ? homeTeam : awayTeam;

  return (
    <div className="boxscore">
      {/* Team tabs */}
      <div className="boxscore__tabs">
        {[
          { key: 'away', team: awayTeam },
          { key: 'home', team: homeTeam },
        ].map(({ key, team }) => (
          <button
            key={key}
            className={`boxscore__tab${activeTab === key ? ' boxscore__tab--active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {team?.logo && <img src={team.logo} alt="" className="boxscore__tab-logo" />}
            <span>{team?.abbreviation}</span>
            <span className="boxscore__tab-name">{team?.name}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="boxscore__table-wrap">
        <table className="abl-table boxscore__table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{ textAlign: col.align }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeStats
              .sort((a, b) => (b.isStarter ? 1 : 0) - (a.isStarter ? 1 : 0) || b.minutesPlayed - a.minutesPlayed)
              .map((stat) => (
                <StatRow key={stat._id} stat={stat} />
              ))}
          </tbody>
          <tfoot>
            <TeamTotals stats={activeStats} />
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default BoxScore;