const Game = require('../models/Game');
const Team = require('../models/Team');

// @desc  Get all games (schedule)
// @route GET /api/games
const getGames = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.season) filter.season = req.query.season;
    if (req.query.team) {
      filter.$or = [{ homeTeam: req.query.team }, { awayTeam: req.query.team }];
    }

    const games = await Game.find(filter)
      .populate('homeTeam', 'name abbreviation logo primaryColor secondaryColor')
      .populate('awayTeam', 'name abbreviation logo primaryColor secondaryColor')
      .sort({ scheduledDate: 1 });

    res.json({ success: true, data: games });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single game
// @route GET /api/games/:id
const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('homeTeam', 'name abbreviation logo primaryColor secondaryColor city')
      .populate('awayTeam', 'name abbreviation logo primaryColor secondaryColor city');

    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    res.json({ success: true, data: game });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get live games only
// @route GET /api/games/live
const getLiveGames = async (req, res) => {
  try {
    const games = await Game.find({ status: 'live' })
      .populate('homeTeam', 'name abbreviation logo primaryColor secondaryColor')
      .populate('awayTeam', 'name abbreviation logo primaryColor secondaryColor')
      .sort({ scheduledDate: 1 });

    res.json({ success: true, data: games });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create game
// @route POST /api/games
const createGame = async (req, res) => {
  try {
    const game = await Game.create(req.body);
    await game.populate([
      { path: 'homeTeam', select: 'name abbreviation logo primaryColor secondaryColor' },
      { path: 'awayTeam', select: 'name abbreviation logo primaryColor secondaryColor' },
    ]);
    res.status(201).json({ success: true, data: game });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc  Update game (status, score, clock, quarter, fouls)
// @route PUT /api/games/:id
const updateGame = async (req, res) => {
  try {
    const game = await Game.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('homeTeam', 'name abbreviation logo primaryColor secondaryColor')
      .populate('awayTeam', 'name abbreviation logo primaryColor secondaryColor');

    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    // If game just ended as 'final', update team W/L records
    if (req.body.status === 'final') {
      await updateTeamRecords(game);
    }

    // Emit real-time update via Socket.io (attached to req.app)
    const io = req.app.get('io');
    if (io) {
      io.to(`game_${game._id}`).emit('gameUpdate', { game });
      io.emit('scoreboardUpdate', { game }); // broadcast to home/schedule viewers
    }

    res.json({ success: true, data: game });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Helper: update team win/loss after game goes final
const updateTeamRecords = async (game) => {
  const homeWon = game.homeScore > game.awayScore;
  const homeIsHome = true;

  await Team.findByIdAndUpdate(game.homeTeam._id || game.homeTeam, {
    $inc: {
      wins: homeWon ? 1 : 0,
      losses: homeWon ? 0 : 1,
      homeWins: homeWon ? 1 : 0,
      homeLosses: homeWon ? 0 : 1,
      pointsFor: game.homeScore,
      pointsAgainst: game.awayScore,
    },
    streak: homeWon ? 'W1' : 'L1',
  });

  await Team.findByIdAndUpdate(game.awayTeam._id || game.awayTeam, {
    $inc: {
      wins: homeWon ? 0 : 1,
      losses: homeWon ? 1 : 0,
      awayWins: homeWon ? 0 : 1,
      awayLosses: homeWon ? 1 : 0,
      pointsFor: game.awayScore,
      pointsAgainst: game.homeScore,
    },
    streak: homeWon ? 'L1' : 'W1',
  });
};

// @desc  Delete game
// @route DELETE /api/games/:id
const deleteGame = async (req, res) => {
  try {
    const game = await Game.findByIdAndDelete(req.params.id);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });
    res.json({ success: true, message: 'Game deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getGames, getGameById, getLiveGames, createGame, updateGame, deleteGame };