const Stats = require('../models/Stats');
const Player = require('../models/Player');

// @desc  Get stats for a game (box score)
// @route GET /api/stats/game/:gameId
const getGameStats = async (req, res) => {
  try {
    const stats = await Stats.find({ game: req.params.gameId })
      .populate('player', 'firstName lastName jerseyNumber position photo')
      .populate('team', 'name abbreviation logo primaryColor')
      .sort({ points: -1 });

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get stats for a specific player
// @route GET /api/stats/player/:playerId
const getPlayerStats = async (req, res) => {
  try {
    const stats = await Stats.find({ player: req.params.playerId })
      .populate('game', 'scheduledDate homeTeam awayTeam homeScore awayScore status')
      .populate('team', 'name abbreviation')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get league leaders
// @route GET /api/stats/leaders
const getLeagueLeaders = async (req, res) => {
  try {
    const minGames = parseInt(req.query.minGames) || 1;

    const leadersPipeline = [
      { $match: { didNotPlay: { $ne: true } } },
      {
        $group: {
          _id: '$player',
          gamesPlayed:     { $sum: 1 },
          totalPoints:     { $sum: '$points' },
          totalRebounds:   { $sum: '$totalRebounds' },
          totalAssists:    { $sum: '$assists' },
          totalSteals:     { $sum: '$steals' },
          totalBlocks:     { $sum: '$blocks' },
          totalTurnovers:  { $sum: '$turnovers' },
          totalMinutes:    { $sum: '$minutesPlayed' },
          totalFgMade:     { $sum: '$fgMade' },
          totalFgAttempts: { $sum: '$fgAttempts' },
          total3pMade:     { $sum: '$threePtMade' },
          total3pAttempts: { $sum: '$threePtAttempts' },
          totalFtMade:     { $sum: '$ftMade' },
          totalFtAttempts: { $sum: '$ftAttempts' },
          team:            { $first: '$team' },
        },
      },
      { $match: { gamesPlayed: { $gte: minGames } } },
      {
        $addFields: {
          avgPoints:    { $round: [{ $divide: ['$totalPoints',    '$gamesPlayed'] }, 1] },
          avgRebounds:  { $round: [{ $divide: ['$totalRebounds',  '$gamesPlayed'] }, 1] },
          avgAssists:   { $round: [{ $divide: ['$totalAssists',   '$gamesPlayed'] }, 1] },
          avgSteals:    { $round: [{ $divide: ['$totalSteals',    '$gamesPlayed'] }, 1] },
          avgBlocks:    { $round: [{ $divide: ['$totalBlocks',    '$gamesPlayed'] }, 1] },
          avgTurnovers: { $round: [{ $divide: ['$totalTurnovers', '$gamesPlayed'] }, 1] },
          avgMinutes:   { $round: [{ $divide: ['$totalMinutes',   '$gamesPlayed'] }, 1] },
          fgPct: {
            $cond: [{ $gt: ['$totalFgAttempts', 0] },
              { $round: [{ $divide: ['$totalFgMade', '$totalFgAttempts'] }, 3] }, 0],
          },
          threePtPct: {
            $cond: [{ $gt: ['$total3pAttempts', 0] },
              { $round: [{ $divide: ['$total3pMade', '$total3pAttempts'] }, 3] }, 0],
          },
          ftPct: {
            $cond: [{ $gt: ['$totalFtAttempts', 0] },
              { $round: [{ $divide: ['$totalFtMade', '$totalFtAttempts'] }, 3] }, 0],
          },
        },
      },
      {
        $lookup: {
          from: 'players', localField: '_id', foreignField: '_id', as: 'playerInfo',
        },
      },
      { $unwind: { path: '$playerInfo', preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: 'teams', localField: 'team', foreignField: '_id', as: 'teamInfo',
        },
      },
      { $unwind: { path: '$teamInfo', preserveNullAndEmptyArrays: true } },
    ];

    const allStats = await Stats.aggregate(leadersPipeline);

    const categories = [
      'avgPoints', 'avgRebounds', 'avgAssists',
      'avgSteals', 'avgBlocks', 'fgPct', 'threePtPct', 'ftPct',
    ];

    const leaders = {};
    for (const cat of categories) {
      leaders[cat] = allStats
        .filter((p) => {
          if (cat === 'fgPct')      return p.totalFgAttempts >= Math.max(1, p.gamesPlayed);
          if (cat === 'threePtPct') return p.total3pAttempts >= Math.max(1, p.gamesPlayed);
          if (cat === 'ftPct')      return p.totalFtAttempts >= Math.max(1, p.gamesPlayed);
          return true;
        })
        .sort((a, b) => b[cat] - a[cat])
        .slice(0, 10)
        .map((p) => ({
          player: {
            _id: p._id,
            fullName: `${p.playerInfo.firstName} ${p.playerInfo.lastName}`,
            jerseyNumber: p.playerInfo.jerseyNumber,
            position: p.playerInfo.position,
            photo: p.playerInfo.photo || '',
          },
          team: {
            _id: p.teamInfo?._id,
            name: p.teamInfo?.name,
            abbreviation: p.teamInfo?.abbreviation,
            logo: p.teamInfo?.logo || '',
          },
          gamesPlayed: p.gamesPlayed,
          value: parseFloat(p[cat].toFixed(cat.includes('Pct') ? 3 : 1)),
        }));
    }

    res.json({ success: true, data: leaders });
  } catch (error) {
    console.error('Leaders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get all player season averages (full stats table)
// @route GET /api/stats/season
const getSeasonStats = async (req, res) => {
  try {
    const pipeline = [
      { $match: { didNotPlay: { $ne: true } } },
      {
        $group: {
          _id: '$player',
          team:            { $first: '$team' },
          gamesPlayed:     { $sum: 1 },
          totalPoints:     { $sum: '$points' },
          totalRebounds:   { $sum: '$totalRebounds' },
          totalOffReb:     { $sum: '$offRebounds' },
          totalDefReb:     { $sum: '$defRebounds' },
          totalAssists:    { $sum: '$assists' },
          totalSteals:     { $sum: '$steals' },
          totalBlocks:     { $sum: '$blocks' },
          totalTurnovers:  { $sum: '$turnovers' },
          totalMinutes:    { $sum: '$minutesPlayed' },
          totalFouls:      { $sum: '$personalFouls' },
          totalFgMade:     { $sum: '$fgMade' },
          totalFgAttempts: { $sum: '$fgAttempts' },
          total3pMade:     { $sum: '$threePtMade' },
          total3pAttempts: { $sum: '$threePtAttempts' },
          totalFtMade:     { $sum: '$ftMade' },
          totalFtAttempts: { $sum: '$ftAttempts' },
        },
      },
      {
        $addFields: {
          avgPoints:    { $round: [{ $divide: ['$totalPoints',    '$gamesPlayed'] }, 1] },
          avgRebounds:  { $round: [{ $divide: ['$totalRebounds',  '$gamesPlayed'] }, 1] },
          avgAssists:   { $round: [{ $divide: ['$totalAssists',   '$gamesPlayed'] }, 1] },
          avgSteals:    { $round: [{ $divide: ['$totalSteals',    '$gamesPlayed'] }, 1] },
          avgBlocks:    { $round: [{ $divide: ['$totalBlocks',    '$gamesPlayed'] }, 1] },
          avgTurnovers: { $round: [{ $divide: ['$totalTurnovers', '$gamesPlayed'] }, 1] },
          avgMinutes:   { $round: [{ $divide: ['$totalMinutes',   '$gamesPlayed'] }, 1] },
          fgPct: {
            $cond: [{ $gt: ['$totalFgAttempts', 0] },
              { $round: [{ $divide: ['$totalFgMade', '$totalFgAttempts'] }, 3] }, 0],
          },
          threePtPct: {
            $cond: [{ $gt: ['$total3pAttempts', 0] },
              { $round: [{ $divide: ['$total3pMade', '$total3pAttempts'] }, 3] }, 0],
          },
          ftPct: {
            $cond: [{ $gt: ['$totalFtAttempts', 0] },
              { $round: [{ $divide: ['$totalFtMade', '$totalFtAttempts'] }, 3] }, 0],
          },
        },
      },
      {
        $lookup: {
          from: 'players', localField: '_id', foreignField: '_id', as: 'playerInfo',
        },
      },
      // Drop any stats where no matching player was found
      { $unwind: { path: '$playerInfo', preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: 'teams', localField: 'team', foreignField: '_id', as: 'teamInfo',
        },
      },
      { $unwind: { path: '$teamInfo', preserveNullAndEmptyArrays: true } },
      { $sort: { avgPoints: -1 } },
    ];

    const stats = await Stats.aggregate(pipeline);
    res.json({ success: true, count: stats.length, data: stats });
  } catch (error) {
    console.error('Season stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create stat line for a player in a game
// @route POST /api/stats
const createStats = async (req, res) => {
  try {
    if (req.body.offRebounds !== undefined || req.body.defRebounds !== undefined) {
      req.body.totalRebounds = (req.body.offRebounds || 0) + (req.body.defRebounds || 0);
    }
    const stats = await Stats.create(req.body);
    await stats.populate([
      { path: 'player', select: 'firstName lastName jerseyNumber position' },
      { path: 'team',   select: 'name abbreviation logo' },
    ]);
    const io = req.app.get('io');
    if (io) io.to(`game_${stats.game}`).emit('statsUpdate', { stats });
    res.status(201).json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc  Update stat line
// @route PUT /api/stats/:id
const updateStats = async (req, res) => {
  try {
    if (req.body.offRebounds !== undefined || req.body.defRebounds !== undefined) {
      const existing = await Stats.findById(req.params.id);
      req.body.totalRebounds =
        (req.body.offRebounds ?? existing.offRebounds) +
        (req.body.defRebounds ?? existing.defRebounds);
    }
    const stats = await Stats.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    }).populate([
      { path: 'player', select: 'firstName lastName jerseyNumber position' },
      { path: 'team',   select: 'name abbreviation logo' },
    ]);
    if (!stats) return res.status(404).json({ success: false, message: 'Stat line not found' });
    const io = req.app.get('io');
    if (io) io.to(`game_${stats.game}`).emit('statsUpdate', { stats });
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc  Bulk upsert stats for a game
// @route POST /api/stats/bulk
const bulkUpsertStats = async (req, res) => {
  try {
    const { gameId, statsArray } = req.body;
    const results = [];
    for (const stat of statsArray) {
      if (stat.offRebounds !== undefined || stat.defRebounds !== undefined) {
        stat.totalRebounds = (stat.offRebounds || 0) + (stat.defRebounds || 0);
      }
      const result = await Stats.findOneAndUpdate(
        { game: gameId, player: stat.player },
        { ...stat, game: gameId },
        { upsert: true, new: true, runValidators: true }
      ).populate([
        { path: 'player', select: 'firstName lastName jerseyNumber position' },
        { path: 'team',   select: 'name abbreviation logo' },
      ]);
      results.push(result);
    }
    const io = req.app.get('io');
    if (io) io.to(`game_${gameId}`).emit('boxScoreUpdate', { gameId, stats: results });
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getGameStats,
  getPlayerStats,
  getLeagueLeaders,
  getSeasonStats,
  createStats,
  updateStats,
  bulkUpsertStats,
};