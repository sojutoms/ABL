const express = require('express');
const router = express.Router();
const {
  getGames,
  getGameById,
  getLiveGames,
  createGame,
  updateGame,
  deleteGame,
} = require('../controllers/gameController');

router.get('/live', getLiveGames);
router.route('/').get(getGames).post(createGame);
router.route('/:id').get(getGameById).put(updateGame).delete(deleteGame);

module.exports = router;