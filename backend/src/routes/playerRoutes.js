const express = require('express');
const router = express.Router();
const {
  getPlayers,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer,
} = require('../controllers/playerController');

router.route('/').get(getPlayers).post(createPlayer);
router.route('/:id').get(getPlayerById).put(updatePlayer).delete(deletePlayer);

module.exports = router;