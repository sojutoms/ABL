import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStats } from '../context/StatsContext';
import './Navbar.css';

// ── Replace this with your actual logo import once you have the file:
// import logoImg from '../assets/abl-logo.png';
const LOGO_SRC = '/favicon.ico';

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { liveGames }           = useStats();
  const location                = useLocation();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  const navLinks = [
    { to: '/',         label: 'Home'     },
    { to: '/schedule', label: 'Schedule', badge: liveGames.length > 0 ? liveGames.length : null },
    { to: '/stats',    label: 'Stats'    },
    { to: '/teams',    label: 'Teams'    },
  ];

  return (
    <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="navbar__inner container">

        {/* Logo */}
        <NavLink to="/" className="navbar__logo">
          <img src={LOGO_SRC} alt="ABL South Hoops" className="navbar__logo-img" />
          <div className="navbar__logo-text">
            <span className="navbar__logo-name">ABL South Hoops</span>
            <span className="navbar__logo-sub">★ Basketball League</span>
          </div>
        </NavLink>

        {/* Desktop: nav links + social */}
        <div className="navbar__right">
          <ul className="navbar__links">
            {navLinks.map(({ to, label, badge }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => `navbar__link${isActive ? ' navbar__link--active' : ''}`}
                >
                  {label}
                  {badge && (
                    <span className="navbar__live-badge">
                      <span className="live-dot" />{badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="navbar__social">
            <a href="https://facebook.com/YOUR_PAGE" target="_blank" rel="noopener noreferrer"
               className="navbar__social-link" aria-label="Facebook">
              <FacebookIcon />
            </a>
            <a href="https://instagram.com/YOUR_HANDLE" target="_blank" rel="noopener noreferrer"
               className="navbar__social-link" aria-label="Instagram">
              <InstagramIcon />
            </a>
          </div>
        </div>

        {/* Burger */}
        <button
          className={`navbar__burger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(m => !m)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`navbar__mobile${menuOpen ? ' navbar__mobile--open' : ''}`}>
        {navLinks.map(({ to, label, badge }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `navbar__mobile-link${isActive ? ' navbar__mobile-link--active' : ''}`}
          >
            {label}
            {badge && <span className="navbar__live-badge"><span className="live-dot" />{badge} LIVE</span>}
          </NavLink>
        ))}
        <div className="navbar__mobile-social">
          <a href="https://www.facebook.com/profile.php?id=61587632257743" target="_blank" rel="noopener noreferrer" className="navbar__social-link navbar__social-link--mobile">
            <FacebookIcon /><span>Facebook</span>
          </a>
          <a href="https://www.instagram.com/ablhoops_south?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener noreferrer" className="navbar__social-link navbar__social-link--mobile">
            <InstagramIcon /><span>Instagram</span>
          </a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;