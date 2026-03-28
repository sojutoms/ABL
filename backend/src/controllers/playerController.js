const Player = require('../models/Player');

// @desc  Get all players (optionally filter by team)
// @route GET /api/players
const getPlayers = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.team) filter.team = req.query.team;

    const players = await Player.find(filter)
      .populate('team', 'name abbreviation primaryColor logo')
      .sort({ lastName: 1 });

    res.json({ success: true, data: players });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single player
// @route GET /api/players/:id
const getPlayerById = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate(
      'team',
      'name abbreviation primaryColor logo'
    );
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    res.json({ success: true, data: player });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create player
// @route POST /api/players
const createPlayer = async (req, res) => {
  try {
    const player = await Player.create(req.body);
    await player.populate('team', 'name abbreviation primaryColor logo');
    res.status(201).json({ success: true, data: player });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc  Update player
// @route PUT /api/players/:id
const updatePlayer = async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('team', 'name abbreviation primaryColor logo');

    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    res.json({ success: true, data: player });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc  Delete player (soft delete)
// @route DELETE /api/players/:id
const deletePlayer = async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    res.json({ success: true, message: 'Player deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getPlayers, getPlayerById, createPlayer, updatePlayer, deletePlayer };