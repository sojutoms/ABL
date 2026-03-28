import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStats } from '../context/StatsContext';
import './Navbar.css';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { liveGames } = useStats();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/schedule', label: 'Schedule', badge: liveGames.length > 0 ? liveGames.length : null },
    { to: '/stats', label: 'Stats' },
    { to: '/teams', label: 'Teams' },
  ];

  return (
    <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="navbar__inner container">
        {/* Logo */}
        <NavLink to="/" className="navbar__logo">
          <div className="navbar__logo-mark">
            <span className="navbar__logo-abl">ABL</span>
          </div>
          <div className="navbar__logo-text">
            <span className="navbar__logo-basketball">BASKETBALL</span>
            <span className="navbar__logo-league">★ LEAGUE</span>
          </div>
        </NavLink>

        {/* Desktop Links */}
        <ul className="navbar__links">
          {navLinks.map(({ to, label, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `navbar__link${isActive ? ' navbar__link--active' : ''}`
                }
                end={to === '/'}
              >
                {label}
                {badge && (
                  <span className="navbar__live-badge">
                    <span className="live-dot" />
                    {badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Mobile Toggle */}
        <button
          className={`navbar__burger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`navbar__mobile${menuOpen ? ' navbar__mobile--open' : ''}`}>
        {navLinks.map(({ to, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `navbar__mobile-link${isActive ? ' navbar__mobile-link--active' : ''}`
            }
            end={to === '/'}
          >
            {label}
            {badge && <span className="navbar__live-badge"><span className="live-dot" />{badge} LIVE</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;