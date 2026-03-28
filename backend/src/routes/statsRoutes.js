const express = require('express');
const router = express.Router();
const {
  getGameStats,
  getPlayerStats,
  getLeagueLeaders,
  getSeasonStats,
  createStats,
  updateStats,
  bulkUpsertStats,
} = require('../controllers/statsController');

router.get('/leaders', getLeagueLeaders);
router.get('/season', getSeasonStats);
router.get('/game/:gameId', getGameStats);
router.get('/player/:playerId', getPlayerStats);
router.post('/bulk', bulkUpsertStats);
router.route('/').post(createStats);
router.route('/:id').put(updateStats);

module.exports = router;