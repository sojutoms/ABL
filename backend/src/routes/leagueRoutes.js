const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Game = require('../models/Game');
const Stats = require('../models/Stats');

// @desc  Get league overview (for Home page)
// @route GET /api/league/overview
router.get('/overview', async (req, res) => {
  try {
    const [teams, liveGames, recentGames, upcomingGames] = await Promise.all([
      Team.find({ isActive: true }).sort({ wins: -1 }).limit(6),
      Game.find({ status: 'live' })
        .populate('homeTeam', 'name abbreviation logo primaryColor secondaryColor')
        .populate('awayTeam', 'name abbreviation logo primaryColor secondaryColor')
        .limit(3),
      Game.find({ status: 'final' })
        .populate('homeTeam', 'name abbreviation logo primaryColor secondaryColor')
        .populate('awayTeam', 'name abbreviation logo primaryColor secondaryColor')
        .sort({ scheduledDate: -1 })
        .limit(5),
      Game.find({ status: 'scheduled' })
        .populate('homeTeam', 'name abbreviation logo primaryColor secondaryColor')
        .populate('awayTeam', 'name abbreviation logo primaryColor secondaryColor')
        .sort({ scheduledDate: 1 })
        .limit(5),
    ]);

    res.json({
      success: true,
      data: { teams, liveGames, recentGames, upcomingGames },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;