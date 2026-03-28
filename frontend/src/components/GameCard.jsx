import React from 'react';
import { useNavigate } from 'react-router-dom';
import './GameCard.css';

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const quarterLabel = (q, isOT) => {
  if (isOT) return 'OT';
  const labels = ['1ST', '2ND', '3RD', '4TH'];
  return labels[q - 1] || `Q${q}`;
};

const TeamRow = ({ team, score, isWinner, isLive }) => (
  <div className={`game-card__team${isWinner ? ' game-card__team--winner' : ''}`}>
    <div className="game-card__team-info">
      {team?.logo ? (
        <img src={team.logo} alt={team.abbreviation} className="game-card__logo" />
      ) : (
        <div
          className="game-card__logo-placeholder"
          style={{ background: team?.primaryColor || '#333' }}
        >
          {team?.abbreviation?.slice(0, 2)}
        </div>
      )}
      <div className="game-card__team-name">
        <span className="game-card__abbr">{team?.abbreviation}</span>
        <span className="game-card__full-name">{team?.name}</span>
      </div>
    </div>
    <span className={`game-card__score${isLive ? ' game-card__score--live' : ''}`}>
      {score ?? '-'}
    </span>
  </div>
);

const GameCard = ({ game, compact = false }) => {
  const navigate = useNavigate();
  const { homeTeam, awayTeam, homeScore, awayScore, status, currentQuarter, gameClock, scheduledDate, isOvertime } = game;

  const isLive = status === 'live';
  const isFinal = status === 'final';
  const isScheduled = status === 'scheduled';

  const homeWon = isFinal && homeScore > awayScore;
  const awayWon = isFinal && awayScore > homeScore;

  const handleClick = () => {
    if (isLive || isFinal) navigate(`/schedule/${game._id}`);
  };

  return (
    <div
      className={`game-card${isLive ? ' game-card--live' : ''}${isFinal || isLive ? ' game-card--clickable' : ''}${compact ? ' game-card--compact' : ''}`}
      onClick={handleClick}
    >
      {/* Status bar */}
      <div className="game-card__header">
        {isLive && (
          <span className="badge badge-live">
            <span className="live-dot" />
            LIVE · {quarterLabel(currentQuarter, isOvertime)} {gameClock}
          </span>
        )}
        {isFinal && <span className="badge badge-final">FINAL</span>}
        {isScheduled && (
          <span className="badge badge-scheduled">
            {formatDate(scheduledDate)} · {formatTime(scheduledDate)}
          </span>
        )}
        {game.round && <span className="game-card__round">{game.round}</span>}
      </div>

      {/* Teams */}
      <div className="game-card__teams">
        <TeamRow
          team={awayTeam}
          score={isScheduled ? null : awayScore}
          isWinner={awayWon}
          isLive={isLive}
        />
        <TeamRow
          team={homeTeam}
          score={isScheduled ? null : homeScore}
          isWinner={homeWon}
          isLive={isLive}
        />
      </div>

      {/* Footer */}
      {(isLive || isFinal) && (
        <div className="game-card__footer">
          <span className="game-card__view-link">View Box Score →</span>
        </div>
      )}
      {isScheduled && game.venue && (
        <div className="game-card__footer">
          <span className="muted small">📍 {game.venue}</span>
        </div>
      )}
    </div>
  );
};

export default GameCard;