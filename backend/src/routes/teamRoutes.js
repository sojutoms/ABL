const express = require('express');
const router = express.Router();
const {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getStandings,
} = require('../controllers/teamController');

router.get('/standings', getStandings);
router.route('/').get(getTeams).post(createTeam);
router.route('/:id').get(getTeamById).put(updateTeam).delete(deleteTeam);

module.exports = router;