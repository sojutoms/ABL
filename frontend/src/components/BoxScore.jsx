import React, { useState } from 'react';
import './BoxScore.css';

const fmtPct = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return (val * 100).toFixed(1) + '%';
};

const fmtNum = (val) => (val === undefined || val === null ? '0' : val);

const COLUMNS = [
  { key: 'player',        label: 'PLAYER', align: 'left'  },
  { key: 'minutesPlayed', label: 'MIN'                     },
  { key: 'points',        label: 'PTS',    highlight: true },
  { key: 'totalRebounds', label: 'REB'                     },
  { key: 'assists',       label: 'AST'                     },
  { key: 'steals',        label: 'STL'                     },
  { key: 'blocks',        label: 'BLK'                     },
  { key: 'fgSplit',       label: 'FG'                      },
  { key: 'fgPct',         label: 'FG%'                     },
  { key: '3pSplit',       label: '3P'                      },
  { key: 'threePtPct',    label: '3P%'                     },
  { key: 'ftSplit',       label: 'FT'                      },
  { key: 'ftPct',         label: 'FT%'                     },
  { key: 'offRebounds',   label: 'OREB'                    },
  { key: 'defRebounds',   label: 'DREB'                    },
  { key: 'turnovers',     label: 'TO'                      },
  { key: 'personalFouls', label: 'PF'                      },
  { key: 'plusMinus',     label: '+/-'                     },
];

// Jersey number circle — shows number, not initials
// const JerseyBadge = ({ number }) => (
//   <span className="jersey-badge">#{number}</span>
// );

const StatRow = ({ stat, isStarter }) => {
  const pm      = stat.plusMinus ?? 0;
  const pmClass = pm > 0 ? 'pm-cell pm-cell--plus' : pm < 0 ? 'pm-cell pm-cell--minus' : 'pm-cell';
  const mins    = typeof stat.minutesPlayed === 'number'
    ? `${Math.floor(stat.minutesPlayed)}:${String(Math.round((stat.minutesPlayed % 1) * 60)).padStart(2,'0')}`
    : fmtNum(stat.minutesPlayed);

  return (
    <tr className={stat.didNotPlay ? 'row--dnp' : isStarter ? 'row--starter' : 'row--bench-player'}>
      <td className="bs-player-cell">
        <span className="bs-jersey">{stat.player?.jerseyNumber}</span>
        <div className="bs-player-info">
          <span className="bs-player-name">{stat.player?.firstName} {stat.player?.lastName}</span>
          <span className="bs-player-pos">{stat.player?.position}</span>
        </div>
        {isStarter && !stat.didNotPlay && <span className="bs-starter-dot" title="Starter" />}
      </td>

      {stat.didNotPlay ? (
        <td colSpan={COLUMNS.length - 1} className="bs-dnp">DNP</td>
      ) : (
        <>
          <td>{mins}</td>
          <td className="bs-pts">{fmtNum(stat.points)}</td>
          <td>{fmtNum(stat.totalRebounds)}</td>
          <td>{fmtNum(stat.assists)}</td>
          <td>{fmtNum(stat.steals)}</td>
          <td>{fmtNum(stat.blocks)}</td>
          <td className="bs-split">{stat.fgMade}-{stat.fgAttempts}</td>
          <td>{fmtPct(stat.fgPct)}</td>
          <td className="bs-split">{stat.threePtMade}-{stat.threePtAttempts}</td>
          <td>{fmtPct(stat.threePtPct)}</td>
          <td className="bs-split">{stat.ftMade}-{stat.ftAttempts}</td>
          <td>{fmtPct(stat.ftPct)}</td>
          <td>{fmtNum(stat.offRebounds)}</td>
          <td>{fmtNum(stat.defRebounds)}</td>
          <td>{fmtNum(stat.turnovers)}</td>
          <td className={stat.personalFouls >= 5 ? 'bs-pf bs-pf--out' : 'bs-pf'}>
            {fmtNum(stat.personalFouls)}
          </td>
          <td className={pmClass}>
            {pm > 0 ? `+${pm}` : fmtNum(pm)}
          </td>
        </>
      )}
    </tr>
  );
};

const SectionDivider = ({ label, colSpan }) => (
  <tr className="bs-section-header">
    <td colSpan={colSpan} className="bs-section-label">{label}</td>
  </tr>
);

const TeamTotals = ({ stats }) => {
  const active  = stats.filter(s => !s.didNotPlay);
  const sum     = (key) => active.reduce((acc, s) => acc + (s[key] || 0), 0);
  const fgMade  = sum('fgMade'),       fgAtt  = sum('fgAttempts');
  const tpMade  = sum('threePtMade'),  tpAtt  = sum('threePtAttempts');
  const ftMade  = sum('ftMade'),       ftAtt  = sum('ftAttempts');
  const totPts  = sum('points');

  return (
    <tr className="bs-totals">
      <td className="bs-totals__label">TOTALS</td>
      <td>—</td>
      <td className="bs-pts">{totPts}</td>
      <td>{sum('totalRebounds')}</td>
      <td>{sum('assists')}</td>
      <td>{sum('steals')}</td>
      <td>{sum('blocks')}</td>
      <td className="bs-split">{fgMade}-{fgAtt}</td>
      <td>{fgAtt > 0 ? (fgMade/fgAtt*100).toFixed(1)+'%' : '-'}</td>
      <td className="bs-split">{tpMade}-{tpAtt}</td>
      <td>{tpAtt > 0 ? (tpMade/tpAtt*100).toFixed(1)+'%' : '-'}</td>
      <td className="bs-split">{ftMade}-{ftAtt}</td>
      <td>{ftAtt > 0 ? (ftMade/ftAtt*100).toFixed(1)+'%' : '-'}</td>
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

  const homeStats = stats.filter(s => s.team?._id === homeTeam?._id || s.team === homeTeam?._id);
  const awayStats = stats.filter(s => s.team?._id === awayTeam?._id || s.team === awayTeam?._id);

  const activeStats = activeTab === 'home' ? homeStats : awayStats;

  // Separate starters (isStarter=true, minutesPlayed > 0) from bench
  const starters = activeStats
    .filter(s => s.isStarter && !s.didNotPlay)
    .sort((a, b) => (b.minutesPlayed || 0) - (a.minutesPlayed || 0));

  const benchPlayers = activeStats
    .filter(s => !s.isStarter && !s.didNotPlay)
    .sort((a, b) => (b.minutesPlayed || 0) - (a.minutesPlayed || 0));

  const dnpPlayers = activeStats.filter(s => s.didNotPlay);

  const colCount = COLUMNS.length;

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
            <span className="boxscore__tab-abbr">{team?.abbreviation}</span>
            <span className="boxscore__tab-name">{team?.name}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="boxscore__table-wrap">
        <table className="abl-table boxscore__table">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ textAlign: col.align || 'right' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ── Starters ────────────────────────── */}
            {starters.length > 0 && (
              <SectionDivider label="▶ Starting Five" colSpan={colCount} />
            )}
            {starters.map(stat => (
              <StatRow key={stat._id} stat={stat} isStarter={true} />
            ))}

            {/* ── Bench ───────────────────────────── */}
            {benchPlayers.length > 0 && (
              <SectionDivider label="— Bench" colSpan={colCount} />
            )}
            {benchPlayers.map(stat => (
              <StatRow key={stat._id} stat={stat} isStarter={false} />
            ))}

            {/* ── DNP ─────────────────────────────── */}
            {dnpPlayers.length > 0 && (
              <SectionDivider label="Did Not Play" colSpan={colCount} />
            )}
            {dnpPlayers.map(stat => (
              <StatRow key={stat._id} stat={stat} isStarter={false} />
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