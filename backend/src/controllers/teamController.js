const Team = require('../models/Team');

// @desc  Get all teams (standings order)
// @route GET /api/teams
const getTeams = async (req, res) => {
  try {
    const teams = await Team.find({ isActive: true }).sort({ wins: -1, losses: 1 });

    // Calculate games behind leader
    const leader = teams[0];
    const teamsWithGB = teams.map((team, index) => {
      const t = team.toJSON();
      if (index === 0) {
        t.gamesBehind = '-';
      } else {
        const gb = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
        t.gamesBehind = gb % 1 === 0 ? gb.toString() : gb.toFixed(1);
      }
      return t;
    });

    res.json({ success: true, data: teamsWithGB });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single team
// @route GET /api/teams/:id
const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create team
// @route POST /api/teams
const createTeam = async (req, res) => {
  try {
    const team = await Team.create(req.body);
    res.status(201).json({ success: true, data: team });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc  Update team
// @route PUT /api/teams/:id
const updateTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    res.json({ success: true, data: team });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc  Delete team (soft delete)
// @route DELETE /api/teams/:id
const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    res.json({ success: true, message: 'Team deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get standings
// @route GET /api/teams/standings
const getStandings = async (req, res) => {
  try {
    const teams = await Team.find({ isActive: true }).sort({ wins: -1, losses: 1 });
    const leader = teams[0];

    const standings = teams.map((team, index) => {
      const t = team.toJSON();
      const total = t.wins + t.losses;
      t.gamesPlayed = total;
      t.winPct = total > 0 ? parseFloat((t.wins / total).toFixed(3)) : 0;

      if (index === 0) {
        t.gamesBehind = '-';
      } else {
        const gb = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
        t.gamesBehind = gb % 1 === 0 ? gb.toString() : gb.toFixed(1);
      }

      t.homeRecord = `${t.homeWins}-${t.homeLosses}`;
      t.awayRecord = `${t.awayWins}-${t.awayLosses}`;
      t.ppg = total > 0 ? parseFloat((t.pointsFor / total).toFixed(1)) : 0;
      t.oppPpg = total > 0 ? parseFloat((t.pointsAgainst / total).toFixed(1)) : 0;
      return t;
    });

    res.json({ success: true, data: standings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getTeams, getTeamById, createTeam, updateTeam, deleteTeam, getStandings };