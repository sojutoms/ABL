import React, { useEffect, useState } from 'react';
import { getGames } from '../services/api';
import GameCard from '../components/GameCard';
import './Schedule.css';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: '🔴 Live' },
  { key: 'final', label: 'Final' },
  { key: 'scheduled', label: 'Upcoming' },
];

const groupByDate = (games) => {
  const groups = {};
  games.forEach((game) => {
    const d = new Date(game.scheduledDate);
    const key = d.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(game);
  });
  return groups;
};

const Schedule = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      try {
        const params = filter !== 'all' ? { status: filter } : {};
        const { data } = await getGames(params);
        setGames(data.data);
      } catch (err) {
        setError('Failed to load schedule.');
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, [filter]);

  const grouped = groupByDate(games);
  const dateKeys = Object.keys(grouped);

  return (
    <div className="page page-enter">
      <div className="container">
        {/* Header */}
        <div className="schedule-header">
          <h1 className="section-title">Schedule</h1>
        </div>

        {/* Filters */}
        <div className="schedule-filters">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`schedule-filter${filter === key ? ' schedule-filter--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {error && <p className="schedule-error">{error}</p>}

        {loading && (
          <div className="schedule-groups">
            {[1, 2].map((k) => (
              <div key={k} className="schedule-group">
                <div className="skeleton" style={{ width: 220, height: 18, marginBottom: 16 }} />
                <div className="games-grid">
                  {[1, 2].map((j) => (
                    <div key={j} className="card" style={{ height: 140 }}>
                      <div className="skeleton" style={{ width: '40%', height: 16, marginBottom: 14 }} />
                      <div className="skeleton" style={{ width: '100%', height: 38, marginBottom: 8 }} />
                      <div className="skeleton" style={{ width: '100%', height: 38 }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && dateKeys.length === 0 && (
          <div className="schedule-empty">
            <p>🏀</p>
            <h3>No games found</h3>
            <p>Check back later for schedule updates.</p>
          </div>
        )}

        {!loading && !error && dateKeys.length > 0 && (
          <div className="schedule-groups">
            {dateKeys.map((dateKey) => (
              <div key={dateKey} className="schedule-group">
                <h3 className="schedule-date-label">{dateKey}</h3>
                <div className="games-grid">
                  {grouped[dateKey].map((game) => (
                    <GameCard key={game._id} game={game} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Schedule;