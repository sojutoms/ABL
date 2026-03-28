import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { StatsProvider } from './context/StatsContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Schedule from './pages/Schedule';
import GameDetail from './pages/GameDetail';
import Stats from './pages/Stats';
import Teams from './pages/Teams';
import './index.css';

function App() {
  return (
    <StatsProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/schedule/:gameId" element={<GameDetail />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/teams" element={<Teams />} />
        </Routes>
      </Router>
    </StatsProvider>
  );
}

export default App;